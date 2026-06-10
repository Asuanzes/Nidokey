import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getParticipantOrNull } from "@/lib/chat/guard";
import { conversationDto } from "@/lib/chat/serialize";

type Ctx = { params: Promise<{ id: string }> };

const PARTICIPANT_INCLUDE = {
  participants: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
} as const;

/**
 * Proyección PÚBLICA MÍNIMA del registro vinculado (banner del chat): título,
 * imagen y un subtítulo — nunca el detalle completo (el registro puede ser de
 * otro usuario). null si el registro ya no existe ("registro eliminado").
 */
async function contextCard(contextType: string | null, contextId: string | null) {
  if (!contextType || !contextId) return null;
  try {
    if (contextType === "property") {
      const p = await prisma.property.findUnique({
        where: { id: contextId },
        select: {
          title: true,
          city: true,
          currentPrice: true,
          monthlyRent: true,
          operationType: true,
          media: { take: 1, orderBy: { order: "asc" }, select: { url: true } },
        },
      });
      if (!p) return null;
      const price =
        p.operationType === "RENT"
          ? p.monthlyRent != null
            ? `${Math.round(p.monthlyRent / 100).toLocaleString("es-ES")} €/mes`
            : null
          : p.currentPrice != null
            ? `${Math.round(p.currentPrice / 100).toLocaleString("es-ES")} €`
            : null;
      return { title: p.title, imageUrl: p.media[0]?.url ?? null, subtitle: [p.city, price].filter(Boolean).join(" · ") || null };
    }
    if (contextType === "book") {
      const b = await prisma.bookRecord.findUnique({
        where: { id: contextId },
        select: { title: true, authors: true, imageUrl: true },
      });
      if (!b) return null;
      return { title: b.title, imageUrl: b.imageUrl, subtitle: b.authors };
    }
    if (contextType === "holiday") {
      const h = await prisma.holiday.findUnique({
        where: { id: contextId },
        select: { title: true, subtitle: true, imageUrl: true },
      });
      if (!h) return null;
      return { title: h.title, imageUrl: h.imageUrl, subtitle: h.subtitle };
    }
    if (contextType === "job") {
      const j = await prisma.jobListing.findUnique({
        where: { id: contextId },
        select: { title: true, subtitle: true, imageUrl: true },
      });
      if (!j) return null;
      return { title: j.title, imageUrl: j.imageUrl, subtitle: j.subtitle };
    }
  } catch {
    // El banner es decorativo: nunca rompe el detalle del chat.
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!(await getParticipantOrNull(id, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const c = await prisma.conversation.findUnique({ where: { id }, include: PARTICIPANT_INCLUDE });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const context = await contextCard(c.contextType, c.contextId);
  return NextResponse.json(conversationDto(c, userId, { context }));
}

const PatchInput = z.object({
  title: z.string().min(1).max(80).optional(),
  muteUntil: z.coerce.date().optional().nullable(),
  pinned: z.boolean().optional(),
  /** true = salir de la conversación (desaparece de mi lista). */
  leave: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await requireUserId();
  const me = await getParticipantOrNull(id, userId);
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.leave) {
    await prisma.conversationParticipant.update({
      where: { id: me.id },
      data: { leftAt: new Date() },
    });
    return NextResponse.json({ ok: true, left: true });
  }

  // Renombrar grupo: solo OWNER/ADMIN.
  if (input.title !== undefined) {
    if (me.role === "MEMBER") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
    }
    await prisma.conversation.update({ where: { id }, data: { title: input.title } });
  }

  // Preferencias propias (mute/pin) — siempre permitidas.
  const myPatch: Record<string, unknown> = {};
  if (input.muteUntil !== undefined) myPatch.muteUntil = input.muteUntil;
  if (input.pinned !== undefined) myPatch.pinnedAt = input.pinned ? new Date() : null;
  if (Object.keys(myPatch).length) {
    await prisma.conversationParticipant.update({ where: { id: me.id }, data: myPatch });
  }

  const c = await prisma.conversation.findUnique({ where: { id }, include: PARTICIPANT_INCLUDE });
  return NextResponse.json(conversationDto(c!, userId));
}
