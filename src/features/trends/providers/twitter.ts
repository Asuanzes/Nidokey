import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";

/**
 * Provider de tendencias de X/Twitter SIN claves (keyless).
 *
 * X/Twitter bloquea la lectura anónima (la API oficial de trends exige tier Pro
 * ~$5k/mes). En su lugar leemos el agregador público trends24.in a través de
 * Jina Reader (https://r.jina.ai/<url>) — un simple GET, gratis y sin API key,
 * que devuelve la página como markdown. Parseamos el bloque de tendencias más
 * reciente. Las noticias relacionadas las resuelve trendNews() vía Google News.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// locale interno -> ruta de país en trends24 ("" = mundial)
const REGION: Record<string, string> = {
  ES: "spain/",
  WORLD: "",
  US: "united-states/",
  MX: "mexico/",
  AR: "argentina/",
};

async function fetchJinaText(targetUrl: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
    headers: { "User-Agent": UA, Accept: "text/plain" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  return res.text();
}

const ITEM_RE = /^\s*(\d+)\.\s+\[([^\]]+)\]\(([^)]+)\)/;

/** Extrae el bloque de tendencias más reciente (primer "### … ago") de trends24. */
function parseTrends24(md: string, limit: number): NormalizedTrend[] {
  const lines = md.split(/\r?\n/);
  // cabecera de tiempo más reciente, p.ej. "### 55 minutes ago"
  let start = lines.findIndex((l) => /^#{2,4}\s+.*\b(ago|now)\b/i.test(l));
  if (start === -1) start = -1; // sin cabecera: escanea desde el principio
  const out: NormalizedTrend[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (start >= 0 && /^#{2,4}\s+/.test(line)) break; // siguiente sección -> solo el bloque reciente
    const m = ITEM_RE.exec(line);
    if (!m) continue;
    const name = m[2].trim();
    if (!name) continue;
    out.push({
      name,
      query: trendToQuery(name),
      rank: parseInt(m[1], 10),
      volume: null,
      url: m[3].trim() || null,
      meta: { via: "trends24+jina" },
    });
    if (out.length >= limit) break;
  }
  return out;
}

export const twitterTrendProvider: TrendProvider = {
  source: "twitter",
  available() {
    return true; // keyless: trends24 vía Jina, sin claves
  },
  async fetchTrends({ locale, limit = 50 }): Promise<TrendListOutcome> {
    const region = REGION[locale.toUpperCase()] ?? "";
    const target = `https://trends24.in/${region}`;
    try {
      const md = await fetchJinaText(target, 20000);
      if (/Anonymous access to domain .* blocked|SecurityCompromiseError/i.test(md)) {
        return { kind: "blocked", reason: "Jina bloqueó temporalmente trends24" };
      }
      const trends = parseTrends24(md, limit);
      if (trends.length === 0) {
        return { kind: "error", error: "trends24: no se pudieron parsear tendencias" };
      }
      return { kind: "ok", trends };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : "trends24 fetch failed" };
    }
  },
};
