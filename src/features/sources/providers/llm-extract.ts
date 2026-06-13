import { ProviderUnavailableError } from "./availability";
import { extractJson as anthropicExtractJson, hasAnthropicKey } from "./claude-extract";

/**
 * Extracción de JSON estructurado con un LLM, eligiendo proveedor por env y
 * priorizando el GRATIS: Google Gemini (GEMINI_API_KEY) → Groq (GROQ_API_KEY, free
 * tier sin billing) → Anthropic Claude (ANTHROPIC_API_KEY, de pago, opcional). Para
 * la vertical comida estructura el markdown que devuelve Crawl4AI en una carta
 * (MENU_SCHEMA). Mismo patrón thin-fetch que el resto de providers: errores como
 * ProviderUnavailableError (reintentable), null = "sin extracción" legítimo.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash"; // gratis y rápido; override por GEMINI_MODEL
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile"; // gratis, sin billing; override por GROQ_MODEL
const MAX_INPUT_CHARS = 40000; // acota tokens de páginas largas

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

/** ¿Hay algún extractor LLM disponible (Gemini/Groq gratis o Claude)? */
export function hasLlmExtractor(): boolean {
  return hasGeminiKey() || hasGroqKey() || hasAnthropicKey();
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

async function geminiExtractJson<T>(
  text: string,
  schema: Record<string, unknown>,
  instruction: string,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim() || "";
  const model = process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL;
  const prompt =
    `${instruction}\n\nDevuelve EXCLUSIVAMENTE un JSON válido que cumpla este JSON Schema ` +
    `(sin markdown ni texto alrededor):\n${JSON.stringify(schema)}\n\n--- CONTENIDO ---\n${text.slice(0, MAX_INPUT_CHARS)}`;
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // responseMimeType fuerza JSON parseable; temperature 0 = determinista.
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
  } catch (e) {
    throw new ProviderUnavailableError("Gemini", e instanceof Error ? e.message : "fallo de red");
  }
  const raw = await res.text();
  if (!res.ok) throw new ProviderUnavailableError("Gemini", `HTTP ${res.status}: ${raw.slice(0, 300)}`);
  let body: GeminiResponse;
  try {
    body = JSON.parse(raw) as GeminiResponse;
  } catch {
    throw new ProviderUnavailableError("Gemini", `respuesta no-JSON: ${raw.slice(0, 200)}`);
  }
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!out) return null;
  try {
    return JSON.parse(out) as T;
  } catch {
    // Por si envuelve en ```json ... ```; rescata el primer objeto {...}.
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

type GroqResponse = { choices?: { message?: { content?: string } }[] };

async function groqExtractJson<T>(
  text: string,
  schema: Record<string, unknown>,
  instruction: string,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  const key = process.env.GROQ_API_KEY?.trim() || "";
  const model = process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
  const prompt =
    `${instruction}\n\nDevuelve EXCLUSIVAMENTE un JSON válido que cumpla este JSON Schema ` +
    `(sin markdown ni texto alrededor):\n${JSON.stringify(schema)}\n\n--- CONTENIDO ---\n${text.slice(0, MAX_INPUT_CHARS)}`;
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }, // JSON mode (el prompt menciona JSON, requerido por la API)
        temperature: 0,
        max_tokens: 8192,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
  } catch (e) {
    throw new ProviderUnavailableError("Groq", e instanceof Error ? e.message : "fallo de red");
  }
  const raw = await res.text();
  if (!res.ok) throw new ProviderUnavailableError("Groq", `HTTP ${res.status}: ${raw.slice(0, 300)}`);
  let body: GroqResponse;
  try {
    body = JSON.parse(raw) as GroqResponse;
  } catch {
    throw new ProviderUnavailableError("Groq", `respuesta no-JSON: ${raw.slice(0, 200)}`);
  }
  const out = body.choices?.[0]?.message?.content?.trim();
  if (!out) return null;
  try {
    return JSON.parse(out) as T;
  } catch {
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

/** Extrae un objeto que cumple `schema` desde `text`, guiado por `instruction`. */
export async function extractJson<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  instruction: string,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  if (hasGeminiKey()) return geminiExtractJson<T>(text, schema, instruction, opts);
  if (hasGroqKey()) return groqExtractJson<T>(text, schema, instruction, opts);
  if (hasAnthropicKey()) return anthropicExtractJson<T>(text, schema, instruction, opts);
  return null;
}
