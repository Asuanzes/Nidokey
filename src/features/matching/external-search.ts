/**
 * Builders de URLs para buscar el mismo inmueble en otros portales.
 * Usamos Google "site:" search en vez de la URL nativa de cada portal.
 *
 * Estrategia: cada portal escribe el título de forma DISTINTA, así que
 * NO podemos buscar el título entero entre comillas. En su lugar:
 *  - Extraemos del título la parte de ubicación (barrio/calle).
 *  - Combinamos con tipo (Casa/Piso/...) + ciudad + m² + habitaciones.
 *  - Solo entrecomillamos la ubicación específica (lo más distintivo).
 */

export type ExternalPortal = {
  key: string;
  label: string;
  domain?: string;
  buildUrl: (q: BuildQuery) => string;
};

export type BuildQuery = {
  title: string;
  city: string | null;
  rooms?: number | null;
  builtArea?: number | null;
};

const TYPE_WORDS = [
  "ático", "atico", "chalet", "casa", "dúplex", "duplex", "estudio",
  "loft", "piso", "apartamento", "vivienda",
];

const PORTAL_WORDS = /\b(idealista|fotocasa|pisos\.?com|habitaclia|yaencontre|thinkspain|indomio)\b/gi;

/**
 * Extrae los términos relevantes del título de un anuncio.
 * Ejemplo: "Casa o chalet independiente en venta en La Manjoya-Parroquias Sur"
 *   → { typeWord: "chalet", location: "La Manjoya" }
 */
function parseTitle(title: string): { typeWord: string | null; location: string | null } {
  const t = title
    .replace(/\(.*?\)/g, "")
    .replace(PORTAL_WORDS, "")
    .replace(/\s+/g, " ")
    .trim();

  // Tipo de inmueble: primer match contra TYPE_WORDS
  let typeWord: string | null = null;
  const lower = t.toLowerCase();
  for (const w of TYPE_WORDS) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
      // Mayúscula inicial
      typeWord = w.charAt(0).toUpperCase() + w.slice(1);
      break;
    }
  }

  // Ubicación: lo que viene después del último "en " (ignorando "en venta")
  let location: string | null = null;
  const cleaned = t.replace(/\ben venta\b/gi, "").replace(/\s+/g, " ");
  const m = cleaned.match(/\ben\s+([^,]+?)\s*$/i);
  if (m) {
    location = m[1].trim();
    // Si tiene "-", quédate con la primera parte (suele ser el barrio principal)
    if (location.includes("-")) location = location.split("-")[0].trim();
    // Recorta si es muy largo
    if (location.length > 50) location = location.split(/\s+/).slice(0, 4).join(" ");
  }
  return { typeWord, location };
}

function googleSiteUrl(domain: string, q: BuildQuery): string {
  const { typeWord, location } = parseTitle(q.title);
  const terms: string[] = [`site:${domain}`];

  // La ubicación es lo más distintivo: ENTRECOMILLADA si la tenemos.
  if (location) terms.push(`"${location}"`);

  // Tipo, ciudad y datos numéricos: sin comillas (Google es flexible).
  if (typeWord) terms.push(typeWord);
  if (q.city && q.city !== location) terms.push(q.city);
  if (q.builtArea) terms.push(`${q.builtArea}m²`);
  if (q.rooms) terms.push(`${q.rooms}`);

  const query = encodeURIComponent(terms.join(" "));
  return `https://www.google.com/search?q=${query}`;
}

export const PORTAL_SEARCHES: ExternalPortal[] = [
  { key: "idealista",  label: "Idealista",  domain: "idealista.com",  buildUrl: (q) => googleSiteUrl("idealista.com", q) },
  { key: "fotocasa",   label: "Fotocasa",   domain: "fotocasa.es",    buildUrl: (q) => googleSiteUrl("fotocasa.es", q) },
  { key: "pisos",      label: "Pisos.com",  domain: "pisos.com",      buildUrl: (q) => googleSiteUrl("pisos.com", q) },
  { key: "habitaclia", label: "Habitaclia", domain: "habitaclia.com", buildUrl: (q) => googleSiteUrl("habitaclia.com", q) },
  { key: "yaencontre", label: "Yaencontre", domain: "yaencontre.com", buildUrl: (q) => googleSiteUrl("yaencontre.com", q) },
  { key: "thinkspain", label: "ThinkSPAIN", domain: "thinkspain.com", buildUrl: (q) => googleSiteUrl("thinkspain.com", q) },
  { key: "indomio",    label: "Indomio",    domain: "indomio.es",     buildUrl: (q) => googleSiteUrl("indomio.es", q) },
];

/**
 * Google Lens con una foto pública. Reverse image search:
 * encuentra el inmueble en cualquier sitio donde aparezca la misma foto.
 */
export function googleLensUrl(photoUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(photoUrl)}`;
}
