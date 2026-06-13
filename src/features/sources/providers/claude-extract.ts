import { ProviderUnavailableError } from "./availability";

/**
 * Extracción de JSON estructurado a partir de texto (markdown/HTML limpio) con
 * Claude, vía la API de Anthropic con **tool-use forzado**: el `schema` (JSON
 * Schema) se pasa como `input_schema` de una tool y se obliga al modelo a
 * llamarla, de modo que su salida cumple el schema sin parseo frágil. Se usa para
 * estructurar la carta que Crawl4AI devuelve como markdown (menu-scrape.ts), sin
 * gastar créditos de Firecrawl. Mismo patrón thin-fetch que firecrawl.ts/
 * google-places.ts: clave en process.env, errores como ProviderUnavailableError
 * (reintentable), null = "sin extracción" legítimo.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PROVIDER = "Anthropic";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001"; // barato y rápido; override por ANTHROPIC_MODEL
const MAX_INPUT_CHARS = 40000; // acota tokens/coste de páginas largas

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function anthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim() || "";
  if (!key) {
    throw new Error("Falta ANTHROPIC_API_KEY. Crea una en console.anthropic.com y ponla en .env / Vercel.");
  }
  return key;
}

type AnthropicResponse = { content?: { type?: string; input?: unknown }[] };

/**
 * Extrae un objeto que cumple `schema` desde `text`, guiado por `instruction`.
 * Devuelve el objeto (input de la tool) o null si el modelo no extrajo nada.
 */
export async function extractJson<T = unknown>(
  text: string,
  schema: Record<string, unknown>,
  instruction: string,
  opts: { timeoutMs?: number; maxTokens?: number } = {},
): Promise<T | null> {
  const content = text.slice(0, MAX_INPUT_CHARS).trim();
  if (!content) return null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        tools: [{ name: "emit_data", description: instruction, input_schema: schema }],
        tool_choice: { type: "tool", name: "emit_data" },
        messages: [{ role: "user", content: `${instruction}\n\n--- CONTENIDO ---\n${content}` }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
  } catch (e) {
    throw new ProviderUnavailableError(PROVIDER, e instanceof Error ? e.message : "fallo de red");
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new ProviderUnavailableError(PROVIDER, `HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }
  let json: AnthropicResponse;
  try {
    json = JSON.parse(raw) as AnthropicResponse;
  } catch {
    throw new ProviderUnavailableError(PROVIDER, `respuesta no-JSON: ${raw.slice(0, 200)}`);
  }
  const toolUse = json.content?.find((b) => b?.type === "tool_use");
  return (toolUse?.input as T | undefined) ?? null;
}
