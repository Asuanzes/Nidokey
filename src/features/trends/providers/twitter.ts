import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";
import { getJsonStrict, isProviderUnavailable } from "@/features/sources/providers/availability";

const WOEID: Record<string, number> = {
  WORLD: 1,
  ES: 23424950,
  US: 23424977,
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function trendUrl(name: string): string {
  return `https://twitter.com/search?q=${encodeURIComponent(name)}&src=trend_click`;
}

function extractArray(json: unknown): Record<string, unknown>[] {
  const root = json as Record<string, unknown> | null;
  const candidates = [
    root?.trends,
    root?.data,
    (root?.data as Record<string, unknown> | undefined)?.trends,
    Array.isArray(root) ? root : null,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  }
  return [];
}

export const twitterTrendProvider: TrendProvider = {
  source: "twitter",
  available() {
    return Boolean(process.env.TWITTERAPI_IO_KEY);
  },
  async fetchTrends({ locale, limit = 50 }): Promise<TrendListOutcome> {
    const key = process.env.TWITTERAPI_IO_KEY;
    if (!key) return { kind: "blocked", reason: "TWITTERAPI_IO_KEY no configurado" };

    const woeid = WOEID[locale.toUpperCase()] ?? WOEID.WORLD;
    const base = process.env.TWITTERAPI_IO_TRENDS_URL ?? "https://api.twitterapi.io/twitter/trends";
    const url = `${base}?woeid=${woeid}`;
    try {
      const json = await getJsonStrict(url, {
        provider: "TwitterAPI.io",
        timeoutMs: 12000,
        headers: { "X-API-Key": key, Authorization: `Bearer ${key}` },
      });
      const raw = extractArray(json);
      const trends: NormalizedTrend[] = raw
        .map((it, i) => {
          const name = str(it.name) ?? str(it.trend) ?? str(it.query);
          if (!name) return null;
          const rank = num(it.rank) ?? i + 1;
          const volume = num(it.tweet_volume) ?? num(it.tweetVolume) ?? num(it.volume);
          return {
            name,
            query: trendToQuery(name),
            rank,
            volume,
            url: str(it.url) ?? trendUrl(name),
            meta: it,
          };
        })
        .filter((x): x is NormalizedTrend => !!x)
        .slice(0, limit);
      return { kind: "ok", trends };
    } catch (e) {
      if (isProviderUnavailable(e)) return { kind: "blocked", reason: e.message };
      return { kind: "error", error: e instanceof Error ? e.message : "twitter fetch failed" };
    }
  },
};
