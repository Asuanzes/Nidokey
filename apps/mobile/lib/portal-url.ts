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
 * Texto crudo compartido (string) de un payload de react-native-share-menu.
 * `data.data` puede ser string o array de { data } / strings según el origen.
 * Devuelve el TEXTO completo (puede ser "Título … URL"); la clasificación
 * (inmueble por URL de portal vs libro por isBookShareText) se hace fuera.
 */
export function extractSharedText(
  data: { data?: unknown } | null | undefined
): string | null {
  const raw = data?.data;
  if (raw == null) return null;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    const text =
      typeof item === "string" ? item : ((item as { data?: string })?.data ?? "");
    if (text) return String(text);
  }
  return null;
}
