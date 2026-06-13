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
// 70b-versatile: 12k tokens/min en free tier (el 8b solo 6k) y mejor calidad. El input
// va condensado a lo relevante del menú aguas arriba, así que cabe de sobra. Override GROQ_MODEL.
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MAX_INPUT_CHARS = 16000; // tope de seguridad; normalmente el texto llega ya condensado

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLooseJson<T>(out: string | undefined): T | null {
  const s = out?.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    const m = s.match(/\{[\s\S]*\}/); // por si lo envuelve en ```json ... ```
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

async function groqExtractJson<T>(
  text: string,
  schema: Record<string, unknown>,
  instruction: string,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  const key = process.env.GROQ_API_KEY?.trim() || "";
  const model = process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
  let content = text.slice(0, MAX_INPUT_CHARS);
  // Reintentos: 413 (request demasiado grande) → recorta; 429 (límite por minuto) → espera.
  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt =
      `${instruction}\n\nDevuelve EXCLUSIVAMENTE un JSON válido que cumpla este JSON Schema ` +
      `(sin markdown ni texto alrededor):\n${JSON.stringify(schema)}\n\n--- CONTENIDO ---\n${content}`;
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }, // JSON mode (el prompt menciona JSON, requerido)
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
    if (res.ok) {
      let body: GroqResponse;
      try {
        body = JSON.parse(raw) as GroqResponse;
      } catch {
        throw new ProviderUnavailableError("Groq", `respuesta no-JSON: ${raw.slice(0, 200)}`);
      }
      return parseLooseJson<T>(body.choices?.[0]?.message?.content);
    }
    if (res.status === 413 && content.length > 2000) {
      content = content.slice(0, Math.floor(content.length * 0.6)); // demasiado grande → recorta y reintenta
      continue;
    }
    if (res.status === 429) {
      const m = raw.match(/try again in ([\d.]+)\s*s/i);
      const waitS = Math.min(m ? Math.ceil(parseFloat(m[1])) + 1 : 20, 30);
      await sleep(waitS * 1000); // límite por minuto → espera lo indicado y reintenta
      continue;
    }
    throw new ProviderUnavailableError("Groq", `HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }
  throw new ProviderUnavailableError("Groq", "límite de Groq tras reintentos (413/429)");
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
