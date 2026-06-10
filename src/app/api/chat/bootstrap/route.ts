import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_FLAGS, CHAT_LIMITS } from "@/lib/chat/config";

/**
 * GET /api/chat/bootstrap — flags + límites + total de no-leídos (badge).
 * El móvil NO hardcodea flags: los recibe de aquí en cada arranque/focus.
 */
export async function GET() {
  const userId = await requireUserId();

  // Total de no-leídos: mensajes posteriores a mi lastReadAt en mis
  // conversaciones activas, excluyendo los míos.
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true, lastReadAt: true },
  });
  let unreadTotal = 0;
  if (memberships.length) {
    const counts = await Promise.all(
      memberships.map((m) =>
        prisma.chatMessage.count({
          where: {
            conversationId: m.conversationId,
            deletedAt: null,
            senderId: { not: userId },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        })
      )
    );
    unreadTotal = counts.reduce((a, b) => a + b, 0);
  }

  return NextResponse.json({
    flags: CHAT_FLAGS,
    limits: {
      maxMessageChars: CHAT_LIMITS.maxMessageChars,
      maxAttachmentsPerMessage: CHAT_LIMITS.maxAttachmentsPerMessage,
      maxGroupParticipants: CHAT_LIMITS.maxGroupParticipants,
      editWindowMin: CHAT_LIMITS.editWindowMin,
    },
    unreadTotal,
  });
}
