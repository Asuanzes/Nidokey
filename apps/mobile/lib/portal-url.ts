/** Hosts de portales inmobiliarios soportados para importar por URL/compartir. */
export const PORTAL_HOSTS = [
  "fotocasa.", "pisos.com", "habitaclia.", "thinkspain.", "indomio.",
  "idealista.", "milanuncios.", "yaencontre.",
];

export function isPortalUrl(u: string): boolean {
  try {
    const hostname = new URL(u).hostname.toLowerCase();
    return PORTAL_HOSTS.some((h) => hostname.includes(h));
  } catch {
    return false;
  }
}

/**
 * Texto crudo de un share (expo-share-intent): `text` (p. ej. "Título … enlace")
 * o `webUrl`. Devuelve el TEXTO completo; la clasificación (inmueble por URL de
 * portal vs libro por isBookShareText) se hace fuera.
 */
export function extractSharedText(
  shareIntent: { text?: string | null; webUrl?: string | null } | null | undefined
): string | null {
  if (!shareIntent) return null;
  // expo-share-intent: texto plano en `text` (Amazon "Título … enlace") o un
  // enlace limpio en `webUrl`. Devolvemos lo que haya, recortado.
  const raw = shareIntent.text ?? shareIntent.webUrl ?? null;
  if (!raw) return null;
  const s = String(raw).trim();
  return s.length ? s : null;
}
