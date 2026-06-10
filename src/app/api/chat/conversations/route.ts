import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_FLAGS, CHAT_LIMITS } from "@/lib/chat/config";
import { anyBlockBetween } from "@/lib/chat/guard";
import { directKey } from "@/lib/chat/util";
import { conversationDto } from "@/lib/chat/serialize";

const PARTICIPANT_INCLUDE = {
  participants: { include: { user: { select: { id: true, name: true, username: true, email: true, image: true } } } },
} as const;

/**
 * GET /api/chat/conversations — mis conversaciones activas, orden
 * pinned primero y luego lastMessageAt desc, con unreadCount por conversación.
 */
export async function GET() {
  const userId = await requireUserId();
  if (!CHAT_FLAGS.enabled) return NextResponse.json({ conversations: [] });

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId, leftAt: null } } },
    include: PARTICIPANT_INCLUDE,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
  });

  const dtos = await Promise.all(
    conversations.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: c.id,
          deletedAt: null,
          senderId: { not: userId },
          ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });
      return conversationDto(c, userId, { unreadCount });
    })
  );

  // Ancladas primero (orden estable dentro de cada grupo).
  dtos.sort((a, b) => {
    const pa = a.pinnedAt ? 1 : 0;
    const pb = b.pinnedAt ? 1 : 0;
    return pb - pa;
  });

  return NextResponse.json({ conversations: dtos });
}

const CreateInput = z.object({
  kind: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
  /** Los DEMÁS participantes (sin incluirme). DIRECT: exactamente 1. */
  participantIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(80).optional().nullable(),
  contextType: z.string().min(1).max(30).optional().nullable(),
  contextId: z.string().min(1).max(64).optional().nullable(),
});

/**
 * POST /api/chat/conversations — crea (o devuelve la existente, en DIRECT por
 * directKey). Bloqueos respetados: un usuario bloqueado no puede abrir 1:1.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!CHAT_FLAGS.enabled) return NextResponse.json({ error: "Chat desactivado" }, { status: 503 });

  const parsed = CreateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const otherIds = Array.from(new Set(input.participantIds.filter((id) => id !== userId)));
  if (otherIds.length === 0) {
    return NextResponse.json({ error: "Faltan participantes" }, { status: 400 });
  }
  const contextType = CHAT_FLAGS.contextLinks ? input.contextType ?? null : null;
  const contextId = CHAT_FLAGS.contextLinks ? input.contextId ?? null : null;

  // Los participantes deben existir.
  const users = await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true } });
  if (users.length !== otherIds.length) {
    return NextResponse.json({ error: "Participante desconocido" }, { status: 400 });
  }

  if (input.kind === "DIRECT") {
    if (otherIds.length !== 1) {
      return NextResponse.json({ error: "Un chat directo tiene exactamente 2 personas" }, { status: 400 });
    }
    const otherId = otherIds[0];
    if (await anyBlockBetween(userId, otherId)) {
      // 403 genérico: no revelamos quién bloqueó a quién.
      return NextResponse.json({ error: "No disponible" }, { status: 403 });
    }
    const key = directKey(userId, otherId, contextId);
    const existing = await prisma.conversation.findUnique({
      where: { directKey: key },
      include: PARTICIPANT_INCLUDE,
    });
    if (existing) {
      // Reactivar mi participación si había "salido" (borrado de la lista).
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId, leftAt: { not: null } },
        data: { leftAt: null },
      });
      return NextResponse.json(conversationDto(existing, userId), { status: 200 });
    }
    const created = await prisma.conversation.create({
      data: {
        kind: "DIRECT",
        createdById: userId,
        directKey: key,
        contextType,
        contextId,
        participants: {
          create: [
            { userId, role: "MEMBER" },
            { userId: otherId, role: "MEMBER" },
          ],
        },
      },
      include: PARTICIPANT_INCLUDE,
    });
    return NextResponse.json(conversationDto(created, userId), { status: 201 });
  }

  // GROUP
  if (!CHAT_FLAGS.groups) {
    return NextResponse.json({ error: "Grupos desactivados" }, { status: 403 });
  }
  if (otherIds.length + 1 > CHAT_LIMITS.maxGroupParticipants) {
    return NextResponse.json({ error: "Demasiados participantes" }, { status: 400 });
  }
  const created = await prisma.conversation.create({
    data: {
      kind: "GROUP",
      title: input.title ?? "Grupo",
      createdById: userId,
      contextType,
      contextId,
      participants: {
        create: [
          { userId, role: "OWNER" },
          ...otherIds.map((id) => ({ userId: id, role: "MEMBER" as const })),
        ],
      },
    },
    include: PARTICIPANT_INCLUDE,
  });
  return NextResponse.json(conversationDto(created, userId), { status: 201 });
}
