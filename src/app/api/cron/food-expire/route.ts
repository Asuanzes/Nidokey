import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createFoodOrderEvent } from "@/lib/food/state";
import { notifyFoodOrder, sendFoodPush } from "@/lib/food/service";
import { paymentProvider } from "@/lib/payments/provider";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const victims = await prisma.foodOrder.findMany({
    where: { status: { in: ["CREATED", "PENDING_PAYMENT"] }, expiresAt: { lt: new Date() } },
    include: { payment: true },
    take: 100,
  });
  let expired = 0;
  for (const order of victims) {
    if (order.payment?.providerIntentId) {
      await paymentProvider(order.payment.provider)?.expire(order.payment.providerIntentId).catch(() => {});
    }
    const ok = await prisma.$transaction(async (tx) => {
      const updated = await tx.foodOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Pago caducado" },
      });
      if (updated.count === 0) return false;
      if (order.payment) await tx.foodPayment.update({ where: { orderId: order.id }, data: { status: "EXPIRED" } });
      await createFoodOrderEvent(tx, {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        actorType: "SYSTEM",
        meta: { reason: "ttl" },
      });
      return true;
    });
    if (ok) {
      expired++;
      after(async () => {
        await notifyFoodOrder(order.id, null);
        await sendFoodPush(order.id, "Pedido caducado", "El pago no se completó a tiempo", null);
      });
    }
  }
  console.log(`[food-expire] expired=${expired}`);
  return NextResponse.json({ expired });
}
