import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signPaymentWebhook, verifyFakePaymentToken } from "@/lib/payments/provider";

function appUrl(): string {
  return (process.env.NEXTAUTH_URL || "https://nidokey.es").replace(/\/+$/, "");
}

export async function POST(req: Request, { params }: { params: Promise<{ intentId: string }> }) {
  const { intentId } = await params;
  const form = await req.formData();
  const token = String(form.get("t") ?? "");
  const payment = await prisma.foodPayment.findUnique({
    where: { provider_providerIntentId: { provider: "fake", providerIntentId: intentId } },
    select: { amountCents: true, orderId: true },
  });
  if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!verifyFakePaymentToken(intentId, token)) {
    return NextResponse.json({ error: "Token de pago invalido" }, { status: 403 });
  }

  const ok = form.get("result") !== "ko";
  const payload = JSON.stringify({
    eventId: `fake_evt_${intentId}_${ok ? "ok" : "ko"}_${Date.now().toString(36)}`,
    type: ok ? "succeeded" : "failed",
    intentId,
    amountCents: payment.amountCents,
  });
  const origin = appUrl();
  const res = await fetch(`${origin}/api/payments/webhook/fake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-nidokey-payment-signature": signPaymentWebhook(payload),
    },
    body: payload,
  });
  if (!res.ok) {
    return NextResponse.json({ error: "No se pudo simular el pago" }, { status: 500 });
  }
  return NextResponse.redirect(`${origin}/food/pay/return?orderId=${encodeURIComponent(payment.orderId)}`, 303);
}
