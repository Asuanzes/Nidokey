import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getCourierOrNull } from "@/lib/food/guard";
import { createFoodOrderEvent } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const courier = await getCourierOrNull(userId);
  if (!courier || !courier.active) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { id } = await params;
  const order = await prisma.foodOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.foodOrder.updateMany({
      where: { id, status: { in: ["PREPARING", "READY"] }, courierId: null },
      data: { courierId: userId },
    });
    if (updated.count === 0) return false;
    await createFoodOrderEvent(tx, {
      orderId: id,
      fromStatus: order.status,
      toStatus: order.status,
      actorType: "COURIER",
      actorId: userId,
      meta: { action: "claim" },
    });
    return true;
  });
  if (!result) return NextResponse.json({ error: "Pedido ya asignado" }, { status: 409 });
  after(async () => {
    await notifyFoodOrder(id, userId);
    await sendFoodPush(id, "Repartidor asignado", "Tu pedido ya tiene repartidor", userId);
  });
  return NextResponse.json({ ok: true });
}
