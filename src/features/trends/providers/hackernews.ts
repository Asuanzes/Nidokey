import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";

/**
 * Provider de Hacker News SIN claves (keyless).
 *
 * Hacker News expone una API pública oficial (Firebase) — sin clave ni scraping:
 *   GET /v0/topstories.json     → array de IDs ordenados por ranking
 *   GET /v0/item/<id>.json      → { title, url, score, by, ... }
 * Tomamos el top N y lo normalizamos. Fuente GLOBAL: ignora el locale y
 * devuelve lo mismo para cualquiera (se guarda bajo cada locale que pida el
 * refresh; la lista por defecto lee ES, así que aparece sin tocar nada).
 */
const BASE = "https://hacker-news.firebaseio.com/v0";
const MAX_ITEMS = 30;

type HnItem = { title?: unknown; url?: unknown; score?: unknown; by?: unknown };

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const hackerNewsProvider: TrendProvider = {
  source: "hackernews",
  available() {
    return true; // keyless: API pública de HN
  },
  async fetchTrends({ limit = 50 }): Promise<TrendListOutcome> {
    const ids = await fetchJson<number[]>(`${BASE}/topstories.json`, 10000);
    if (!ids || ids.length === 0) {
      return { kind: "blocked", reason: "HN: topstories no disponible" };
    }
    const top = ids.slice(0, Math.min(limit, MAX_ITEMS));
    const items = await Promise.all(
      top.map(async (id, idx): Promise<NormalizedTrend | null> => {
        const it = await fetchJson<HnItem>(`${BASE}/item/${id}.json`, 10000);
        const title = it && typeof it.title === "string" ? it.title.trim() : "";
        if (!title) return null;
        return {
          name: title,
          query: trendToQuery(title),
          rank: idx + 1,
          volume: typeof it!.score === "number" ? it!.score : null,
          url:
            typeof it!.url === "string" && it!.url
              ? (it!.url as string)
              : `https://news.ycombinator.com/item?id=${id}`,
          meta: { via: "hn-api", by: typeof it!.by === "string" ? it!.by : null },
        };
      }),
    );
    const trends = items.filter((x): x is NormalizedTrend => x !== null);
    if (trends.length === 0) return { kind: "error", error: "HN: sin items" };
    return { kind: "ok", trends };
  },
};
