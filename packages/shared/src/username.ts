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

// Marcas protegidas contra SUPLANTACIÓN: se bloquea cualquier alias que, tras
// plegar homoglifos comunes (0→o,1→i,3→e,4→a,5→s,8→b) y quitar separadores,
// CONTENGA una de estas. Así caen "nidokey1", "n1dok3y", "real_nidokey", etc.
// ponytail: fold básico ASCII; homoglifos unicode exóticos quedan fuera —
// subir a una librería de "confusables" solo si aparece abuso real.
const PROTECTED = ["nidokey"];

function foldConfusables(u: string): string {
  return u
    .replace(/[_.\-]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/8/g, "b");
}

function looksLikeProtected(u: string): boolean {
  const f = foldConfusables(u);
  return PROTECTED.some((b) => f.includes(b));
}

/** Normaliza la entrada del usuario (quita @, minúsculas, recorta espacios). */
export function normalizeUsername(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).trim().replace(/^@+/, "").toLowerCase();
}

/** ¿Es un alias válido (ya normalizado o sin normalizar)? */
export function isValidUsername(raw: string | null | undefined): boolean {
  return usernameError(raw) === null;
}

/** Motivo de invalidez (clave i18n del cliente), o null si es válido. */
export function usernameError(raw: string | null | undefined): "format" | "reserved" | null {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) return "format";
  if (RESERVED.has(u) || looksLikeProtected(u)) return "reserved";
  return null;
}
