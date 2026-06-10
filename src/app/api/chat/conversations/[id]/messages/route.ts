import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_LIMITS } from "@/lib/chat/config";
import { anyBlockBetween, getParticipantOrNull, withinMessageRate } from "@/lib/chat/guard";
import { messagePreview, sanitizeMessageBody } from "@/lib/chat/util";
import { messageDto } from "@/lib/chat/serialize";
import { sendChatPush } from "@/lib/chat/push";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/chat/conversations/[id]/messages?cursor=<messageId>&limit=50
 * Paginación keyset hacia atrás (los `limit` anteriores al cursor; sin cursor,
 * los más recientes). Devuelve en orden cronológico ASC dentro de la página.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!(await getParticipantOrNull(id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10) || CHAT_LIMITS.messagesPageSize,
    100
  );

  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit,
    include: { attachments: true },
  });

  const hasMore = rows.length === limit;
  const nextCursor = hasMore ? rows[rows.length - 1].id : null;
  // ASC para que el cliente pinte de arriba (viejo) a abajo (nuevo).
  const messages = rows.reverse().map(messageDto);

  return NextResponse.json({ messages, nextCursor });
}

const SendInput = z.object({
  clientId: z.string().min(1).max(64).optional(),
  kind: z.enum(["TEXT"]).default("TEXT"), // IMAGE/FILE/AUDIO llegan en F4
  body: z.string().min(1),
  replyToId: z.string().optional().nullable(),
});

/**
 * POST — enviar mensaje. Idempotente por clientId (reintento devuelve 200 con
 * el ya creado). Actualiza lastMessageAt/preview de la conversación.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await requireUserId();
  const me = await getParticipantOrNull(id, userId);
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = SendInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const body = sanitizeMessageBody(input.body, CHAT_LIMITS.maxMessageChars);
  if (!body) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

  // Idempotencia: el mismo clientId no crea duplicado.
  if (input.clientId) {
    const existing = await prisma.chatMessage.findUnique({
      where: {
        conversationId_senderId_clientId: {
          conversationId: id,
          senderId: userId,
          clientId: input.clientId,
        },
      },
      include: { attachments: true },
    });
    if (existing) return NextResponse.json(messageDto(existing), { status: 200 });
  }

  // Bloqueos en DIRECT: si cualquiera bloqueó al otro, no se envía.
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { kind: true, participants: { where: { leftAt: null }, select: { userId: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.kind === "DIRECT") {
    const other = conversation.participants.find((p) => p.userId !== userId);
    if (other && (await anyBlockBetween(userId, other.userId))) {
      return NextResponse.json({ error: "No disponible" }, { status: 403 });
    }
  }

  // Rate limit (count en BBDD: serverless-safe).
  if (!(await withinMessageRate(userId, CHAT_LIMITS.rateMsgsPerMin))) {
    return NextResponse.json(
      { error: "Demasiados mensajes, espera un momento" },
      { status: 429, headers: { "Retry-After": "30" } }
    );
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: id,
        senderId: userId,
        kind: input.kind,
        body,
        replyToId: input.replyToId ?? null,
        clientId: input.clientId ?? null,
      },
      include: { attachments: true },
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: now, lastMessagePreview: messagePreview(input.kind, body) },
    }),
    // Enviar implica haber leído lo anterior.
    prisma.conversationParticipant.update({
      where: { id: me.id },
      data: { lastReadAt: now, lastDeliveredAt: now },
    }),
  ]);

  // Push a los demás participantes (best-effort, no bloquea la respuesta más de
  // una llamada HTTP rápida). F3: webhook al gateway WS cuando exista.
  try {
    await sendChatPush(message);
  } catch {
    // nunca rompe el envío
  }

  return NextResponse.json(messageDto(message), { status: 201 });
}
