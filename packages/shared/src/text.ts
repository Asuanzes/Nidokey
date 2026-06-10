/**
 * Limpieza y validación de texto libre (descripciones de anuncios).
 * Puro JS sin dependencias (Node + React Native). El extractor del WebView
 * (apps/mobile/lib/portal-extractors.ts) replica esta lógica en JS inyectado;
 * el backend la usa como guard final sobre CUALQUIER origen (share, pegado,
 * formulario manual, scrapers).
 */

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function safeCp(code: number): string {
  try {
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

/** Decodifica las entidades HTML más comunes (incl. numéricas → acentos es). */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)));
}

function cutAtBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + "…";
}

/**
 * Normaliza una descripción: quita tags, decodifica entidades, colapsa espacios
 * y saltos, recorta a `maxChars` en frontera de palabra. Devuelve "" si no queda
 * nada útil.
 */
export function cleanDescription(
  raw: string | null | undefined,
  opts: { maxChars?: number } = {}
): string {
  if (!raw) return "";
  const maxChars = opts.maxChars ?? 4000;
  // Saltos de línea → espacio (evita pegar palabras de párrafos distintos).
  const collapsed = String(raw).replace(/\r?\n+/g, " ");
  const text = decodeEntities(stripTags(collapsed)).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return cutAtBoundary(text, maxChars);
}

const JUNK_COOKIES = /cookies|consentimiento|pol[ií]tica de privacidad|aceptar y continuar/i;
const JUNK_SIMILAR = /(anuncios?|inmuebles?|viviendas?|propiedades?)\s+(similares|relacionad[oa]s)|tambi[eé]n te puede interesar|otras viviendas/i;
const JUNK_PHONE_ONLY = /^[\s\d+()/.\-]{6,}$/;
const JUNK_CTA = /contacta|ll[aá]ma|solicita (m[aá]s )?informaci[oó]n|ver tel[eé]fono|pide cita|reserva (ya|ahora)|env[ií]a(r)? mensaje/i;

/**
 * Heurística: ¿este texto NO es la descripción real del propietario? (banner de
 * cookies, "anuncios similares", solo teléfono, CTA corto, demasiado corto).
 * Se aplica sobre texto YA limpiado con cleanDescription.
 */
export function isLikelyJunkDescription(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = s.trim();
  if (t.length < 25) return true;
  if (JUNK_PHONE_ONLY.test(t)) return true;
  if (JUNK_COOKIES.test(t)) return true;
  if (JUNK_SIMILAR.test(t)) return true;
  // CTA dominante solo penaliza textos cortos (una descripción larga puede
  // mencionar "contacta para visitar" de forma legítima).
  if (t.length < 120 && JUNK_CTA.test(t)) return true;
  return false;
}
