import { ProviderUnavailableError } from "./availability";

/**
 * Cliente fino del servidor Docker de Crawl4AI (https://crawl4ai.com) self-hosted
 * en el VPS (junto al chat gateway), expuesto en `scrape.nidokey.es` tras nginx
 * con TLS + un bearer compartido. Renderiza la página con Playwright y devuelve
 * MARKDOWN limpio; la extracción del menú a JSON la hace Claude en Node
 * (claude-extract.ts), no Crawl4AI. Es la fuente de scraping GRATIS (alternativa
 * a Firecrawl, de pago). Mismo patrón que firecrawl.ts/google-places.ts:
 * config en process.env, fetch crudo, errores como ProviderUnavailableError
 * (reintentable), null = "sin contenido" legítimo.
 *
 * Contrato REST (Crawl4AI Docker, puerto interno 11235):
 *   POST /crawl { urls, browser_config, crawler_config }
 *   → [{ success, markdown, html, cleaned_html, status_code, error_message }]
 */

const PROVIDER = "Crawl4AI";

export function hasCrawl4aiConfig(): boolean {
  return Boolean(process.env.CRAWL4AI_URL?.trim() && process.env.CRAWL4AI_SECRET?.trim());
}

function base(): string {
  const url = process.env.CRAWL4AI_URL?.trim();
  if (!url) {
    throw new Error("Falta CRAWL4AI_URL. Despliega Crawl4AI en el VPS (carpeta crawl4ai/) y ponla en .env / Vercel.");
  }
  return url.replace(/\/+$/, "");
}

type CrawlResult = {
  success?: boolean;
  markdown?: string | { raw_markdown?: string; fit_markdown?: string };
  status_code?: number;
  error_message?: string | null;
};

function pickMarkdown(r: CrawlResult | undefined): string | null {
  const md = r?.markdown;
  if (typeof md === "string") return md.trim() || null;
  const raw = md?.fit_markdown?.trim() || md?.raw_markdown?.trim();
  return raw || null;
}

/**
 * Renderiza `url` con Crawl4AI y devuelve su markdown limpio. null = sin contenido
 * útil. Lanza ProviderUnavailableError en fallo de red/HTTP (el caller hace fallback).
 */
export async function crawl4aiMarkdown(url: string, opts: { timeoutMs?: number } = {}): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 45000;
  const secret = process.env.CRAWL4AI_SECRET?.trim() || "";
  let res: Response;
  try {
    res = await fetch(`${base()}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        urls: [url],
        browser_config: { type: "BrowserConfig", params: { headless: true } },
        crawler_config: { type: "CrawlerRunConfig", params: { cache_mode: "bypass", page_timeout: timeoutMs } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs + 15000),
    });
  } catch (e) {
    throw new ProviderUnavailableError(PROVIDER, e instanceof Error ? e.message : "fallo de red");
  }
  const text = await res.text();
  if (!res.ok) {
    throw new ProviderUnavailableError(PROVIDER, `HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProviderUnavailableError(PROVIDER, `respuesta no-JSON: ${text.slice(0, 200)}`);
  }
  // El server devuelve un array de resultados, o { results: [...] } según versión.
  const arr: CrawlResult[] = Array.isArray(parsed)
    ? (parsed as CrawlResult[])
    : Array.isArray((parsed as { results?: CrawlResult[] })?.results)
      ? (parsed as { results: CrawlResult[] }).results
      : [];
  return pickMarkdown(arr[0]);
}
