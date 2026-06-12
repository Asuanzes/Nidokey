import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStaffOrNull } from "@/lib/food/guard";
import { transitionFoodOrder } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";
import { paymentProvider } from "@/lib/payments/provider";

const Body = z.object({ reason: z.string().min(2).max(280) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const order = await prisma.foodOrder.findUnique({ where: { id }, include: { payment: true } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const staff = await getStaffOrNull(userId, order.restaurantId);
  if (!staff) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status !== "PAID" && order.status !== "PREPARING") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 409 });
  }
  const refund = order.payment?.providerIntentId
    ? await paymentProvider(order.payment.provider)?.refund(order.payment.providerIntentId).catch(() => null)
    : null;
  await transitionFoodOrder({
    id,
    from: order.status,
    to: "CANCELLED",
    actorType: "RESTAURANT",
    actorId: userId,
    data: { cancelledAt: new Date(), cancelReason: parsed.data.reason },
    meta: { reason: parsed.data.reason },
    effect: async () => {
      await notifyFoodOrder(id, userId);
      await sendFoodPush(id, "Pedido cancelado", parsed.data.reason, userId);
    },
  });
  if (order.payment) {
    await prisma.foodPayment.update({
      where: { orderId: id },
      data: { status: refund ? "REFUNDED" : "SUCCEEDED", providerRefundId: refund?.refundId, errorCode: refund ? null : "REFUND_FAILED" },
    });
  }
  return NextResponse.json({ ok: true, refunded: !!refund });
}
