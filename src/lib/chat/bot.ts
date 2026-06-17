import { prisma } from "@/lib/db";
import { directKey, messagePreview } from "@/lib/chat/util";
import { sendChatPush } from "@/lib/chat/push";
import { notifyMessage } from "@/lib/chat/gateway";

const MAX_REPLY_CHARS = 800;

/**
 * El asistente "Nidokey" es un participante de chat normal (una fila User), no
 * un caso especial del esquema. Se reconoce por id/username CONSTANTES:
 *  - el id fijo permite enrutar los mensajes hacia el agente,
 *  - el username "nidokey" ya está reservado en username.ts (anti-suplantación).
 * ponytail: sin campo `isBot` en el esquema — el badge "verificado" del front
 * se deriva de `username === NIDOKEY_BOT_USERNAME`, no necesita columna nueva.
 */
export const NIDOKEY_BOT_ID = "nidokey-bot";
export const NIDOKEY_BOT_USERNAME = "nidokey";

/** Crea (idempotente) la fila User del bot. */
export async function ensureNidokeyBot(): Promise<void> {
  await prisma.user.upsert({
    where: { id: NIDOKEY_BOT_ID },
    update: {},
    create: {
      id: NIDOKEY_BOT_ID,
      email: "nido@nidokey.es", // único; el bot no inicia sesión (sin Account)
      name: "Nidokey",
      username: NIDOKEY_BOT_USERNAME,
      emailVerified: new Date(),
    },
    select: { id: true },
  });
}

/**
 * Garantiza (idempotente) el DM 1:1 entre el usuario y el bot, y devuelve su id.
 * Tras la primera vez es un solo findUnique por `directKey`.
 */
export async function ensureBotDm(userId: string): Promise<string | null> {
  if (userId === NIDOKEY_BOT_ID) return null;
  await ensureNidokeyBot();
  const key = directKey(userId, NIDOKEY_BOT_ID);
  const existing = await prisma.conversation.findUnique({
    where: { directKey: key },
    select: { id: true, lastMessageAt: true },
  });
  if (existing) {
    // Sana DMs creados vacíos antes de añadir el saludo (no salían en la lista).
    if (existing.lastMessageAt === null) await seedWelcome(existing.id);
    return existing.id;
  }
  const created = await prisma.conversation.create({
    data: {
      kind: "DIRECT",
      createdById: NIDOKEY_BOT_ID,
      directKey: key,
      participants: {
        create: [
          { userId, role: "MEMBER" },
          { userId: NIDOKEY_BOT_ID, role: "MEMBER" },
        ],
      },
    },
    select: { id: true },
  });
  await seedWelcome(created.id);
  return created.id;
}

/**
 * Saludo inicial para que el DM nazca "no vacío" (con lastMessageAt + preview) y
 * aparezca en la lista. ponytail: sin dedup fuerte — dos bootstraps simultáneos
 * podrían duplicar el saludo (carrera improbable); subir a lock/upsert si pasa.
 */
async function seedWelcome(conversationId: string): Promise<void> {
  const welcome =
    "👋 ¡Hola! Soy Nidokey, tu asistente dentro de la app. Aún estoy aprendiendo: " +
    "pronto podré buscarte registros, importar enlaces y guiarte. Escríbeme lo que necesites.";
  await prisma.chatMessage.create({
    data: { conversationId, senderId: NIDOKEY_BOT_ID, kind: "TEXT", body: welcome },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), lastMessagePreview: messagePreview("TEXT", welcome) },
  });
}

/** ¿La conversación es un DM 1:1 con el bot? (participantes activos = userIds). */
export function isBotDirect(kind: string, participantUserIds: string[]): boolean {
  return kind === "DIRECT" && participantUserIds.includes(NIDOKEY_BOT_ID);
}

/**
 * Responde como Nidokey en la conversación, por el MISMO camino que un humano:
 * crea el mensaje, actualiza el preview y avisa (push + gateway WS). Fase 3 =
 * eco; en la fase 4 el `text` lo generará Gemini. Pensado para correr dentro de
 * `after()` (post-respuesta), así que cualquier fallo es no-bloqueante.
 */
export async function replyAsBot(conversationId: string, text: string): Promise<void> {
  const body = text.slice(0, MAX_REPLY_CHARS);
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: { conversationId, senderId: NIDOKEY_BOT_ID, kind: "TEXT", body },
    include: { attachments: true },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now, lastMessagePreview: messagePreview("TEXT", body) },
  });
  await Promise.allSettled([sendChatPush(message), notifyMessage(message)]);
}

/** Fase 3: eco simple (sin IA). Reemplazado por Gemini en la fase 4. */
export function echoReply(userText: string | null): string {
  const t = (userText ?? "").trim();
  if (!t) return "🪺 Recibí tu mensaje. Pronto podré ayudarte con la app.";
  return `🪺 Recibí: «${t.slice(0, 200)}». Pronto sabré ayudarte de verdad con la app.`;
}
