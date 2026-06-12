import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStaffOrNull, staffCanManageMenu } from "@/lib/food/guard";

const Body = z.object({ isOpen: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const staff = await getStaffOrNull(userId, id);
  if (!staff || !staffCanManageMenu(staff.role)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  const restaurant = await prisma.restaurant.update({ where: { id }, data: { isOpen: parsed.data.isOpen } });
  return NextResponse.json({ restaurant });
}
