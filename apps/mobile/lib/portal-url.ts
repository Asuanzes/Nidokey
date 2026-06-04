import { isBookUrl } from "@/lib/book-url";

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
 * Extrae la primera URL de portal de un payload de share
 * (react-native-share-menu). `data.data` puede ser string o array de
 * { data } / strings, según el origen del intent.
 */
export function extractSharedUrl(
  data: { data?: unknown } | null | undefined
): string | null {
  const raw = data?.data;
  if (raw == null) return null;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    const text =
      typeof item === "string" ? item : ((item as { data?: string })?.data ?? "");
    const match = String(text).match(/https?:\/\/[^\s]+/);
    if (match && (isPortalUrl(match[0]) || isBookUrl(match[0]))) return match[0];
  }
  return null;
}
