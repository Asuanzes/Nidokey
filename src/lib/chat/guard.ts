import { prisma } from "@/lib/db";
import type { ConversationParticipant } from "@prisma/client";

/**
 * Guard de autorización del chat. Toda lectura/escritura de conversaciones y
 * mensajes pasa por aquí: si el usuario no es participante ACTIVO (sin leftAt),
 * se devuelve null y el handler responde 404 — nunca 403, para no filtrar la
 * existencia de conversaciones ajenas (mismo patrón que ensureOwner).
 */
export async function getParticipantOrNull(
  conversationId: string,
  userId: string
): Promise<ConversationParticipant | null> {
  return prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, leftAt: null },
  });
}

/** ¿blockerId tiene bloqueado a blockedId? (dirección única) */
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const row = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });
  return !!row;
}

/** ¿Hay bloqueo en CUALQUIER dirección entre dos usuarios? */
export async function anyBlockBetween(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

/**
 * Rate limit serverless-safe: nº de mensajes del usuario en los últimos 60 s
 * contra BBDD (sin memoria de proceso). Devuelve true si puede enviar.
 */
export async function withinMessageRate(userId: string, perMin: number): Promise<boolean> {
  const since = new Date(Date.now() - 60_000);
  const count = await prisma.chatMessage.count({
    where: { senderId: userId, createdAt: { gte: since } },
  });
  return count < perMin;
}
