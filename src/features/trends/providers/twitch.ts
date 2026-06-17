import type { TrendProvider, TrendListOutcome, NormalizedTrend } from "@/features/trends/types";
import { trendToQuery } from "@/features/trends/normalize";
import { fetchJinaText, isJinaBlocked } from "@/features/trends/providers/_jina";

/**
 * Provider de Twitch SIN claves (keyless), best-effort.
 *
 * La API oficial de Twitch exige registrar una app (client-id). En su lugar
 * leemos la página pública de categorías ("Explorar") vía Jina Reader y
 * extraemos los juegos/categorías en tendencia (enlaces a /directory/category/).
 * Es FRÁGIL (página JS): si no parsea nada devuelve blocked/error y el refresh
 * sigue con el resto. Fuente global: ignora locale.
 */
const TARGET = "https://www.twitch.tv/directory";

/** "126K" / "1.2M" / "3,4 mil" → entero (best-effort). */
function parseViewers(num: string, unit?: string): number | null {
  const base = parseFloat(num.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(base)) return null;
  const u = unit?.toUpperCase();
  const mult = u === "B" ? 1e9 : u === "M" ? 1e6 : u === "K" ? 1e3 : 1;
  return Math.round(base * mult);
}

// Reconoce un texto de enlace que es SOLO un recuento de espectadores
// ("126K viewers", "3,4 mil espectadores") → no es nombre de categoría.
const VIEWERS_ONLY = /^[\d.,]+\s*[KMB]?\s*(?:viewers|espectadores|spectateurs|viewer|mil)\b/i;
const VIEWERS_CAP = /([\d.,]+)\s*([KMB])?\s*(?:viewers|espectadores|spectateurs|viewer)/i;

function parseCategories(md: string, limit: number): NormalizedTrend[] {
  // En el directorio de Twitch (vía Jina) cada categoría aparece como VARIOS
  // enlaces al mismo /directory/category/<slug>: uno con el nombre del juego y
  // otro cuyo texto es el recuento de espectadores. Agrupamos por slug, nos
  // quedamos con el primer nombre "real" y aprovechamos el recuento como volumen.
  type Entry = { name: string; volume: number | null; url: string };
  const bySlug = new Map<string, Entry>();
  const order: string[] = [];
  const re = /\[([^\]]{1,80})\]\((https?:\/\/[^)]*\/directory\/category\/([^/)]+)[^)]*)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const text = m[1].replace(/\[|\]/g, "").trim();
    const url = m[2].trim();
    const slug = decodeURIComponent(m[3]).toLowerCase();
    if (!slug) continue;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { name: "", volume: null, url });
      order.push(slug);
    }
    const entry = bySlug.get(slug)!;
    if (VIEWERS_ONLY.test(text)) {
      if (entry.volume == null) {
        const vm = VIEWERS_CAP.exec(text);
        if (vm) entry.volume = parseViewers(vm[1], vm[2]);
      }
    } else if (!entry.name && text.length <= 60) {
      // El texto a veces trae "Juego | 126K viewers": separa nombre y volumen.
      const vm = /^(.*?)\s*[|·]\s*([\d.,]+)\s*([KMB])?\s*(?:viewers|espectadores|spectateurs|viewer)/i.exec(text);
      if (vm) {
        entry.name = vm[1].trim();
        if (entry.volume == null) entry.volume = parseViewers(vm[2], vm[3]);
      } else {
        entry.name = text;
      }
    }
  }

  const out: NormalizedTrend[] = [];
  for (const slug of order) {
    if (out.length >= limit) break;
    const e = bySlug.get(slug)!;
    if (!e.name) continue;
    out.push({
      name: e.name,
      query: trendToQuery(e.name),
      rank: out.length + 1,
      volume: e.volume,
      url: e.url,
      meta: { via: "twitch+jina" },
    });
  }
  return out;
}

export const twitchProvider: TrendProvider = {
  source: "twitch",
  available() {
    return true; // keyless vía Jina (best-effort)
  },
  async fetchTrends({ limit = 50 }): Promise<TrendListOutcome> {
    let md: string;
    try {
      md = await fetchJinaText(TARGET, 20000);
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : "twitch fetch failed" };
    }
    if (isJinaBlocked(md)) return { kind: "blocked", reason: "Twitch: Jina bloqueado" };
    const trends = parseCategories(md, limit);
    if (trends.length === 0) return { kind: "error", error: "Twitch: sin categorías parseables" };
    return { kind: "ok", trends };
  },
};
