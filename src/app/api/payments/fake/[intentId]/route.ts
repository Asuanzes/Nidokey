import { NextResponse } from "next/server";
import { signPaymentWebhook } from "@/lib/payments/provider";

export async function POST(req: Request, { params }: { params: Promise<{ intentId: string }> }) {
  const { intentId } = await params;
  const url = new URL(req.url);
  const form = await req.formData();
  const orderId = String(form.get("orderId") ?? "");
  const amountCents = Number(form.get("amountCents") ?? 0);
  const returnUrl = String(form.get("returnUrl") ?? "");
  const ok = form.get("result") !== "ko";
  const payload = JSON.stringify({
    eventId: `fake_evt_${intentId}_${ok ? "ok" : "ko"}_${Date.now().toString(36)}`,
    type: ok ? "succeeded" : "failed",
    intentId,
    amountCents,
  });
  const res = await fetch(`${url.origin}/api/payments/webhook/fake`, {
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
  return NextResponse.redirect(returnUrl || `${url.origin}/food/pay/return?orderId=${encodeURIComponent(orderId)}`, 303);
}
