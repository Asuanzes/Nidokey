import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_FLAGS, CHAT_LIMITS } from "@/lib/chat/config";
import { unreadByConversation } from "@/lib/chat/unread";
import { ensureBotDm } from "@/lib/chat/bot";

/**
 * GET /api/chat/bootstrap — flags + límites + total de no-leídos (badge).
 * El móvil NO hardcodea flags: los recibe de aquí en cada arranque/focus.
 */
export async function GET() {
  const userId = await requireUserId();

  // El chat con el asistente "Nidokey" siempre presente: lo aseguramos aquí
  // (idempotente). No bloqueante — si fallara, el bootstrap sigue dando el badge.
  // ponytail: write dentro de un GET, pero ocurre una sola vez por usuario
  // (luego es findUnique); mover a un job si bootstrap se vuelve caliente.
  if (CHAT_FLAGS.enabled) {
    try {
      await ensureBotDm(userId);
    } catch (e) {
      console.error("[chat-bot] ensureBotDm:", e);
    }
  }

  // Total de no-leídos: una query de membresías + una agregada (antes: un
  // count por conversación = N+1).
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true },
  });
  let unreadTotal = 0;
  if (memberships.length) {
    const unread = await unreadByConversation(
      userId,
      memberships.map((m) => m.conversationId)
    );
    for (const n of unread.values()) unreadTotal += n;
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
