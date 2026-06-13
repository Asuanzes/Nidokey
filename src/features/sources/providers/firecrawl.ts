import { ProviderUnavailableError } from "./availability";

/**
 * Cliente fino de Firecrawl (https://firecrawl.dev) v2.
 * Se usa para la vertical comida: (1) resolver la URL del restaurante en una
 * plataforma de delivery (search) y (2) extraer su carta con un schema JSON
 * (scrape con formato "json"). Mismo patrón que google-places.ts:
 * clave en process.env, throttle a nivel módulo, fetch crudo, errores como
 * ProviderUnavailableError (reintentable) y null = "sin datos" legítimo.
 */

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";
const PROVIDER = "Firecrawl";

function firecrawlKey(): string {
  const key = process.env.FIRECRAWL_API_KEY?.trim() || "";
  if (!key) {
    throw new Error("Falta FIRECRAWL_API_KEY. Crea una clave en firecrawl.dev y ponla en .env / Vercel.");
  }
  return key;
}

export function hasFirecrawlKey(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

let lastCall = 0;
async function throttle(ms = 300): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function firecrawlPost<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  await throttle();
  let res: Response;
  try {
    res = await fetch(`${FIRECRAWL_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new ProviderUnavailableError(PROVIDER, e instanceof Error ? e.message : "fallo de red");
  }
  const text = await res.text();
  if (!res.ok) {
    throw new ProviderUnavailableError(PROVIDER, `HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderUnavailableError(PROVIDER, `respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

export type FirecrawlSearchResult = { url: string; title: string; description: string };

/** Búsqueda web. Devuelve [] si no hay resultados (señal legítima). */
export async function firecrawlSearch(query: string, limit = 8): Promise<FirecrawlSearchResult[]> {
  const json = await firecrawlPost<{ data?: { web?: { url?: string; title?: string; description?: string }[] } }>(
    "/search",
    { query, limit },
    15000
  );
  return (json?.data?.web ?? [])
    .filter((r): r is { url: string } & typeof r => typeof r.url === "string")
    .map((r) => ({ url: r.url, title: r.title ?? "", description: r.description ?? "" }));
}

/**
 * Scrapea una URL y extrae datos estructurados según `schema` (JSON Schema).
 * Devuelve el objeto extraído (data.json) o null si no hubo extracción.
 */
export async function firecrawlScrapeJson<T = unknown>(
  url: string,
  schema: Record<string, unknown>,
  opts: { prompt?: string; timeoutMs?: number; maxAge?: number } = {}
): Promise<T | null> {
  const json = await firecrawlPost<{ data?: { json?: T } }>(
    "/scrape",
    {
      url,
      formats: [{ type: "json", schema, ...(opts.prompt ? { prompt: opts.prompt } : {}) }],
      onlyMainContent: false,
      timeout: opts.timeoutMs ?? 45000,
      // Si Firecrawl tiene la página cacheada más nueva que maxAge (ms), la devuelve
      // sin re-renderizar → mucho más rápido en 2ºs scrapes / refrescos de la misma URL.
      ...(opts.maxAge ? { maxAge: opts.maxAge } : {}),
    },
    (opts.timeoutMs ?? 45000) + 10000
  );
  return json?.data?.json ?? null;
}
