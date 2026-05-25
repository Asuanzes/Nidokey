import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PropertyInput } from "@/lib/validators";
import { requireUserId } from "@/lib/auth-helpers";

type Ctx = { params: Promise<{ id: string }> };

/** Verifica que el property pertenece al usuario. Devuelve 404 si no es suyo. */
async function ensureOwner(id: string, ownerId: string) {
  const exists = await prisma.property.findFirst({ where: { id, ownerId }, select: { id: true } });
  return !!exists;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const property = await prisma.property.findFirst({
    where: { id, ownerId },
    include: {
      media: { orderBy: { order: "asc" } },
      listings: true,
      priceHistory: { orderBy: { observedAt: "asc" } },
    },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(property);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  if (!(await ensureOwner(id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const parsed = PropertyInput.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const property = await prisma.property.update({ where: { id }, data: parsed.data });
  return NextResponse.json(property);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  if (!(await ensureOwner(id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.property.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
