import type { NormalizedTrend, TrendListOutcome, TrendProvider } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";
import { getJsonStrict, ProviderUnavailableError, isProviderUnavailable } from "@/features/sources/providers/availability";

const UA = "NidokeyTrends/0.1 by buysell-asturias";

let tokenCache: { token: string; exp: number } | null = null;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function redditToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 60_000) return tokenCache.token;

  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) throw new ProviderUnavailableError("Reddit", "credenciales no configuradas");

  let res: Response;
  try {
    res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new ProviderUnavailableError("Reddit", e instanceof Error ? e.message : "fallo de red");
  }
  if (!res.ok) throw new ProviderUnavailableError("Reddit", `HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const token = str(json?.access_token);
  if (!token) throw new ProviderUnavailableError("Reddit", "token vacío");
  const expires = num(json?.expires_in) ?? 3600;
  tokenCache = { token, exp: now + Math.max(60, expires - 60) * 1000 };
  return token;
}

function children(json: unknown): Record<string, unknown>[] {
  const root = json as Record<string, unknown> | null;
  const arr = (root?.data as Record<string, unknown> | undefined)?.children;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (x as Record<string, unknown> | null)?.data)
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

function toTrend(post: Record<string, unknown>, rank: number): NormalizedTrend | null {
  const title = str(post.title);
  if (!title) return null;
  const subreddit = str(post.subreddit_name_prefixed) ?? str(post.subreddit);
  const score = num(post.score);
  const comments = num(post.num_comments);
  const permalink = str(post.permalink);
  return {
    name: title,
    query: trendToQuery(title),
    rank,
    volume: score != null || comments != null ? Math.round((score ?? 0) + (comments ?? 0) * 2) : null,
    url: permalink ? `https://www.reddit.com${permalink}` : null,
    meta: { subreddit, score, comments, id: str(post.id) },
  };
}

export const redditTrendProvider: TrendProvider = {
  source: "reddit",
  available() {
    return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  },
  async fetchTrends({ limit = 50 }): Promise<TrendListOutcome> {
    try {
      const token = await redditToken();
      const headers = { Authorization: `Bearer ${token}`, "User-Agent": UA };
      const urls = [
        "https://oauth.reddit.com/r/popular/hot?limit=50",
        "https://oauth.reddit.com/r/popular/rising?limit=50",
      ];
      const collected: Record<string, unknown>[] = [];
      for (const url of urls) {
        const json = await getJsonStrict(url, { provider: "Reddit", timeoutMs: 12000, headers });
        collected.push(...children(json));
      }
      const seen = new Set<string>();
      const trends: NormalizedTrend[] = [];
      for (const post of collected) {
        const key = str(post.id) ?? str(post.url) ?? str(post.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const trend = toTrend(post, trends.length + 1);
        if (trend) trends.push(trend);
        if (trends.length >= limit) break;
      }
      return { kind: "ok", trends };
    } catch (e) {
      if (isProviderUnavailable(e)) return { kind: "blocked", reason: e.message };
      return { kind: "error", error: e instanceof Error ? e.message : "reddit fetch failed" };
    }
  },
};

