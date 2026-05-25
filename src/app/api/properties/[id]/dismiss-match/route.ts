import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  candidateId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "candidateId requerido" }, { status: 400 });
  }
  const ownerId = await requireUserId();
  const p = await prisma.property.findFirst({ where: { id, ownerId }, select: { matchDismissed: true } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const next = Array.from(new Set([...p.matchDismissed, parsed.data.candidateId]));
  await prisma.property.update({
    where: { id },
    data: { matchDismissed: next },
  });
  // Marcar también en MatchSuggestion (en ambos sentidos por si existen)
  await prisma.matchSuggestion.updateMany({
    where: {
      OR: [
        { sourceId: id, targetId: parsed.data.candidateId },
        { sourceId: parsed.data.candidateId, targetId: id },
      ],
    },
    data: { dismissedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
