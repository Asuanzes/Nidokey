/**
 * Utilidades de similitud para cross-matching de inmuebles.
 * Puro JS, compatible Node y React Native.
 */

const STOPWORDS = new Set([
  "en", "venta", "compra", "el", "la", "los", "las", "un", "una", "unos", "unas",
  "de", "del", "y", "o", "u", "a", "al", "con", "para", "por", "sin", "se",
  "casa", "piso", "chalet", "atico", "duplex", "estudio", "loft", "inmueble",
  "vivienda", "apartamento", "anuncio",
  "idealista", "fotocasa", "pisos", "habitaclia", "yaencontre", "thinkspain", "indomio",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugifyTitle(s: string | null | undefined): string {
  if (!s) return "";
  const base = stripAccents(s.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = base
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return tokens.join(" ").slice(0, 120);
}

export function bigrams(slug: string): Set<string> {
  const out = new Set<string>();
  const s = ` ${slug} `;
  for (let i = 0; i < s.length - 1; i++) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
