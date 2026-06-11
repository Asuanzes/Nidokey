import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Conteo de no-leídos agregado en UNA query (sustituye al patrón N+1 de un
 * count por conversación, que se ejecutaba en cada poll de la lista).
 *
 * Misma semántica que el count original: mensajes no borrados, de OTROS
 * (senderId <> userId excluye también senderId NULL, igual que Prisma
 * `not: userId`), posteriores a mi lastReadAt (o todos si nunca leí), solo en
 * conversaciones donde sigo activo (leftAt NULL).
 */
export async function unreadByConversation(
  userId: string,
  conversationIds: string[]
): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ conversationId: string; unread: bigint }[]>`
    SELECT m."conversationId", COUNT(*)::bigint AS unread
    FROM "ChatMessage" m
    JOIN "ConversationParticipant" p
      ON p."conversationId" = m."conversationId"
     AND p."userId" = ${userId}
     AND p."leftAt" IS NULL
    WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
      AND m."deletedAt" IS NULL
      AND m."senderId" <> ${userId}
      AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
    GROUP BY m."conversationId"
  `;
  return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));
}
