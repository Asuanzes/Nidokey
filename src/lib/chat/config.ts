/**
 * Configuración del chat: límites, ventanas y feature flags. Los flags se leen
 * de env (distintos por entorno en Vercel) y el móvil los recibe vía
 * GET /api/chat/bootstrap — nunca hardcodear flags en el cliente.
 */

const num = (env: string | undefined, def: number): number => {
  const n = env != null ? parseInt(env, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
};
const bool = (env: string | undefined, def: boolean): boolean =>
  env == null || env === "" ? def : env === "1" || env.toLowerCase() === "true";

export const CHAT_LIMITS = {
  maxMessageChars: num(process.env.CHAT_MAX_MESSAGE_CHARS, 4000),
  maxAttachmentsPerMessage: 6,
  maxAttachmentMbImage: num(process.env.CHAT_MAX_ATTACHMENT_MB, 10),
  maxAttachmentMbFile: 25,
  maxGroupParticipants: 64,
  editWindowMin: 15,
  deleteForAllWindowMin: 60,
  /** Mensajes por minuto y usuario (rate limit serverless-safe: count en BBDD). */
  rateMsgsPerMin: 30,
  /** Resultados de búsqueda de usuarios. */
  userSearchLimit: 10,
  /** Página de mensajes (keyset). */
  messagesPageSize: 50,
} as const;

export const CHAT_FLAGS = {
  enabled: bool(process.env.CHAT_ENABLED, true),
  groups: bool(process.env.CHAT_ENABLE_GROUPS, true),
  attachments: bool(process.env.CHAT_ENABLE_ATTACHMENTS, false), // F4
  voice: bool(process.env.CHAT_ENABLE_VOICE, false),
  typing: bool(process.env.CHAT_ENABLE_TYPING, true),
  contextLinks: bool(process.env.CHAT_ENABLE_CONTEXT_LINKS, true),
  /** Incluir el cuerpo del mensaje en la notificación push. */
  pushPreview: bool(process.env.CHAT_PUSH_PREVIEW, true),
} as const;

/** Retención en días; null = no borrar nunca (default). */
export const CHAT_RETENTION_DAYS: number | null = (() => {
  const n = parseInt(process.env.CHAT_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
})();
