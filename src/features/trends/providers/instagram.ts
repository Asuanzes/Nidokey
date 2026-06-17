import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";
import { fetchJinaText, isJinaBlocked } from "@/features/trends/providers/_jina";

/**
 * Provider de Instagram SIN claves (keyless), best-effort.
 *
 * Instagram no expone API pública de tendencias. Leemos la página /explore/ vía
 * Jina Reader y extraemos temas/hashtags en tendencia ("Tema · 16M posts" y
 * enlaces a /explore/tags/...). Es FRÁGIL (página JS, a veces muro de login):
 * si no parsea nada devuelve blocked/error y el refresh sigue con el resto sin
 * romperse. Fuente global: ignora locale.
 */
const TARGET = "https://www.instagram.com/explore/";

function parseVolume(num: string, unit?: string): number | null {
  const base = parseFloat(num.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(base)) return null;
  const mult = unit?.toUpperCase() === "B" ? 1e9 : unit?.toUpperCase() === "M" ? 1e6 : unit?.toUpperCase() === "K" ? 1e3 : 1;
  return Math.round(base * mult);
}

function parseExplore(md: string, limit: number): NormalizedTrend[] {
  const out: NormalizedTrend[] = [];
  const seen = new Set<string>();
  const push = (name: string, volume: number | null, url: string | null) => {
    const clean = name.replace(/\[|\]/g, "").trim();
    if (!clean || clean.length > 60) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: clean, query: trendToQuery(clean), rank: out.length + 1, volume, url, meta: { via: "instagram+jina" } });
  };

  for (const rawLine of md.split(/\r?\n/)) {
    if (out.length >= limit) break;
    const line = rawLine.trim();
    if (!line) continue;
    // "Tema · 16M posts" / "Topic · 1.2M publicaciones"
    const m = /^(?:[-*]\s*)?(?:\[)?([^[\]·\n]{2,60}?)(?:\])?\s*·\s*([\d.,]+)\s*([KMB])?\s*(?:posts|publicaciones)/i.exec(line);
    if (m) {
      push(m[1], parseVolume(m[2], m[3]), null);
      continue;
    }
    // enlaces a hashtags: [#algo](.../explore/tags/algo/)
    const tag = /\[([^\]]{1,60})\]\((https?:\/\/[^)]*\/explore\/tags\/[^)]+)\)/i.exec(line);
    if (tag) push(tag[1].startsWith("#") ? tag[1] : `#${tag[1]}`, null, tag[2]);
  }
  return out;
}

export const instagramProvider: TrendProvider = {
  source: "instagram",
  available() {
    return true; // keyless vía Jina (best-effort)
  },
  async fetchTrends({ limit = 50 }): Promise<TrendListOutcome> {
    let md: string;
    try {
      md = await fetchJinaText(TARGET, 20000);
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : "instagram fetch failed" };
    }
    if (isJinaBlocked(md)) return { kind: "blocked", reason: "Instagram requiere login / Jina bloqueado" };
    const trends = parseExplore(md, limit);
    if (trends.length === 0) return { kind: "blocked", reason: "Instagram: sin tendencias parseables (muro de login)" };
    return { kind: "ok", trends };
  },
};
