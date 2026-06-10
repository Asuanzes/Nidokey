/**
 * Reglas del alias público de chat (@username, estilo Telegram). Puro JS.
 * - 3–20 caracteres, minúsculas, empieza por letra, luego letras/dígitos/_.
 * - Se normaliza quitando un "@" inicial y pasando a minúsculas.
 */

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "support",
  "soporte",
  "nidokey",
  "system",
  "root",
  "me",
  "null",
  "undefined",
]);

/** Normaliza la entrada del usuario (quita @, minúsculas, recorta espacios). */
export function normalizeUsername(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).trim().replace(/^@+/, "").toLowerCase();
}

/** ¿Es un alias válido (ya normalizado o sin normalizar)? */
export function isValidUsername(raw: string | null | undefined): boolean {
  const u = normalizeUsername(raw);
  return USERNAME_RE.test(u) && !RESERVED.has(u);
}

/** Motivo de invalidez (clave i18n del cliente), o null si es válido. */
export function usernameError(raw: string | null | undefined): "format" | "reserved" | null {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) return "format";
  if (RESERVED.has(u)) return "reserved";
  return null;
}
