import { XMLParser } from "fast-xml-parser";
import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";

/**
 * Provider de Google Trends SIN claves (keyless).
 *
 * Google publica el RSS oficial de búsquedas en tendencia por país:
 *   https://trends.google.com/trending/rss?geo=ES
 * Es un GET directo (no necesita Jina), fiable, y trae volumen aproximado de
 * búsqueda (ht:approx_traffic) + noticias relacionadas. Lo parseamos con
 * fast-xml-parser (mismo patrón que news.ts).
 */
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// locale interno -> geo de Google Trends. "WORLD" no tiene geo natural → US.
const GEO: Record<string, string> = {
  ES: "ES",
  WORLD: "US",
  US: "US",
  MX: "MX",
  AR: "AR",
};

function asArray(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter(
    (x): x is Record<string, unknown> => !!x && typeof x === "object",
  );
}

/** "1.000+" / "500+" / "2 mil+" → entero (best-effort). */
function parseTraffic(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function firstNewsUrl(item: Record<string, unknown>): string | null {
  for (const ni of asArray(item["ht:news_item"])) {
    const u = ni["ht:news_item_url"];
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return null;
}

export const googleTrendsProvider: TrendProvider = {
  source: "googletrends",
  available() {
    return true; // keyless: RSS público
  },
  async fetchTrends({ locale, limit = 50 }): Promise<TrendListOutcome> {
    const geo = GEO[locale.toUpperCase()] ?? "US";
    const url = `https://trends.google.com/trending/rss?geo=${geo}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : "google-trends fetch failed" };
    }
    if (!res.ok) return { kind: "blocked", reason: `Google Trends HTTP ${res.status}` };

    let json: { rss?: { channel?: { item?: unknown } } };
    try {
      json = parser.parse(await res.text());
    } catch {
      return { kind: "error", error: "google-trends: XML inválido" };
    }

    const trends: NormalizedTrend[] = [];
    let rank = 1;
    for (const it of asArray(json?.rss?.channel?.item)) {
      const title = typeof it.title === "string" ? it.title.trim() : "";
      if (!title) continue;
      trends.push({
        name: title,
        query: trendToQuery(title),
        rank: rank++,
        volume: parseTraffic(it["ht:approx_traffic"]),
        url: firstNewsUrl(it),
        meta: { via: "google-trends-rss", geo },
      });
      if (trends.length >= limit) break;
    }

    if (trends.length === 0) return { kind: "error", error: "google-trends: feed vacío" };
    return { kind: "ok", trends };
  },
};
