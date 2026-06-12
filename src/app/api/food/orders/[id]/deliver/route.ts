import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getCourierOrNull } from "@/lib/food/guard";
import { transitionFoodOrder } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const courier = await getCourierOrNull(userId);
  if (!courier || !courier.active) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const order = await prisma.foodOrder.findFirst({ where: { id, courierId: userId } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status !== "IN_DELIVERY") return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
  await transitionFoodOrder({
    id,
    from: "IN_DELIVERY",
    to: "DELIVERED",
    actorType: "COURIER",
    actorId: userId,
    data: { deliveredAt: new Date() },
    effect: async () => {
      await notifyFoodOrder(id, userId);
      await sendFoodPush(id, "Pedido entregado", "Pedido completado", userId);
    },
  });
  return NextResponse.json({ ok: true });
}
