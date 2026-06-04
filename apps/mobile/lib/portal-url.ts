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
 * Extrae la URL de portal de un share de expo-share-intent: primero `webUrl`
 * (URL directa, p. ej. al compartir una página desde Safari/Chrome); si no, la
 * primera URL que aparezca dentro de `text`.
 */
export function extractSharedUrl(
  shareIntent: { webUrl?: string | null; text?: string | null } | null | undefined
): string | null {
  if (!shareIntent) return null;
  if (shareIntent.webUrl && isPortalUrl(shareIntent.webUrl)) return shareIntent.webUrl;
  const match = String(shareIntent.text ?? "").match(/https?:\/\/[^\s]+/);
  if (match && isPortalUrl(match[0])) return match[0];
  return null;
}
