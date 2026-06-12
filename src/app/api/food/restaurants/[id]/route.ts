import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { id, active: true },
    include: {
      categories: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ restaurant });
}
