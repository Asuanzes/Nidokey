import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStaffOrNull } from "@/lib/food/guard";
import { transitionFoodOrder } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const order = await prisma.foodOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const staff = await getStaffOrNull(userId, order.restaurantId);
  if (!staff) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status !== "PAID") return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
  await transitionFoodOrder({
    id,
    from: "PAID",
    to: "PREPARING",
    actorType: "RESTAURANT",
    actorId: userId,
    data: { acceptedAt: new Date() },
    effect: async () => {
      await notifyFoodOrder(id, userId);
      await sendFoodPush(id, "Pedido aceptado", "El restaurante ya lo está preparando", userId);
    },
  });
  return NextResponse.json({ ok: true });
}
