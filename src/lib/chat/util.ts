/**
 * Utilidades puras del chat (testeables sin BBDD).
 */

/**
 * Clave de dedupe para conversaciones DIRECT: las mismas dos personas solo
 * tienen UNA conversación general y una por cada registro vinculado.
 * `sort` garantiza que (A,B) y (B,A) colisionen.
 */
export function directKey(userA: string, userB: string, contextId?: string | null): string {
  return [userA, userB].sort().join("|") + "|" + (contextId ?? "general");
}

/** Snippet para la lista de conversaciones (vaciable si E2E futuro). */
export function messagePreview(kind: string, body: string | null | undefined): string {
  if (kind === "IMAGE") return "📷 Foto";
  if (kind === "FILE") return "📎 Archivo";
  if (kind === "AUDIO") return "🎤 Audio";
  const t = (body ?? "").replace(/\s+/g, " ").trim();
  return t.length > 140 ? t.slice(0, 139) + "…" : t;
}

/**
 * Sanea el cuerpo de un mensaje: el texto del usuario es literal (no se
 * "limpia" como una descripción), solo se quitan caracteres de control C0/C1
 * (salvo salto de línea y tab) y se aplica el límite. Filtro por code point
 * para evitar regex de control-chars. Devuelve null si no queda nada.
 */
export function sanitizeMessageBody(raw: string | null | undefined, maxChars: number): string | null {
  if (!raw) return null;
  let out = "";
  for (const ch of String(raw)) {
    const c = ch.codePointAt(0) ?? 0;
    const isControl = (c < 32 && c !== 10 && c !== 9) || (c >= 127 && c <= 159);
    if (!isControl) out += ch;
  }
  const t = out.trim();
  if (!t) return null;
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}
