import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { createFoodOrderEvent } from "@/lib/food/state";
import { paymentProvider } from "@/lib/payments/provider";

function appUrl(req: Request): string {
  const origin = req.headers.get("origin");
  return (origin || process.env.NEXTAUTH_URL || "https://nidokey.es").replace(/\/+$/, "");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const order = await prisma.foodOrder.findFirst({
    where: { id, customerId: userId },
    include: { payment: true },
  });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (order.status === "CANCELLED" || order.status === "DELIVERED") {
    return NextResponse.json({ error: "Pedido cerrado" }, { status: 400 });
  }
  if (order.payment?.status === "SUCCEEDED") {
    return NextResponse.json({ checkoutUrl: order.payment.checkoutUrl, payment: order.payment });
  }
  const provider = paymentProvider("fake");
  if (!provider) return NextResponse.json({ error: "Proveedor no disponible" }, { status: 500 });
  const returnUrl = `${appUrl(req)}/food/pay/return?orderId=${encodeURIComponent(order.id)}`;
  const intent = await provider.createIntent({
    amountCents: order.totalCents,
    currency: order.currency,
    orderId: order.id,
    returnUrl,
  });

  const payment = await prisma.$transaction(async (tx) => {
    if (order.status === "CREATED") {
      const updated = await tx.foodOrder.updateMany({
        where: { id: order.id, status: "CREATED" },
        data: { status: "PENDING_PAYMENT" },
      });
      if (updated.count === 0) throw new Error("El pedido ya ha cambiado de estado");
      await createFoodOrderEvent(tx, {
        orderId: order.id,
        fromStatus: "CREATED",
        toStatus: "PENDING_PAYMENT",
        actorType: "SYSTEM",
      });
    }
    if (order.payment) {
      return tx.foodPayment.update({
        where: { orderId: order.id },
        data: {
          provider: "fake",
          providerIntentId: intent.intentId,
          status: "PENDING",
          amountCents: order.totalCents,
          currency: order.currency,
          checkoutUrl: intent.checkoutUrl,
          errorCode: null,
        },
      });
    }
    return tx.foodPayment.create({
      data: {
        orderId: order.id,
        provider: "fake",
        providerIntentId: intent.intentId,
        status: "PENDING",
        amountCents: order.totalCents,
        currency: order.currency,
        checkoutUrl: intent.checkoutUrl,
      },
    });
  });
  return NextResponse.json({ checkoutUrl: intent.checkoutUrl, payment });
}
