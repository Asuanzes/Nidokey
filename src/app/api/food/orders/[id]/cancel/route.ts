import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { transitionFoodOrder } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";
import { paymentProvider } from "@/lib/payments/provider";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const order = await prisma.foodOrder.findFirst({ where: { id, customerId: userId }, include: { payment: true } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status !== "CREATED" && order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "El pedido ya no puede cancelarse" }, { status: 400 });
  }
  const provider = order.payment ? paymentProvider(order.payment.provider) : null;
  if (provider && order.payment?.providerIntentId) await provider.expire(order.payment.providerIntentId).catch(() => {});
  await transitionFoodOrder({
    id,
    from: order.status,
    to: "CANCELLED",
    actorType: "CUSTOMER",
    actorId: userId,
    data: { cancelledAt: new Date(), cancelReason: "Cliente" },
    effect: async () => {
      await notifyFoodOrder(id, userId);
      await sendFoodPush(id, "Pedido cancelado", "El cliente ha cancelado el pedido", userId);
    },
  });
  if (order.payment) {
    await prisma.foodPayment.update({ where: { orderId: id }, data: { status: "EXPIRED" } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
