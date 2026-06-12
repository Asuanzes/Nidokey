import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentEvent = {
  eventId: string;
  type: "succeeded" | "failed" | "refunded";
  intentId: string;
  amountCents: number;
};

export interface PaymentProvider {
  createIntent(p: {
    amountCents: number;
    currency: string;
    orderId: string;
    returnUrl: string;
  }): Promise<{ intentId: string; checkoutUrl: string }>;
  verifyWebhook(req: Request): Promise<(PaymentEvent & { payload: unknown }) | null>;
  getIntentStatus(intentId: string): Promise<"pending" | "succeeded" | "failed" | "expired">;
  refund(intentId: string): Promise<{ refundId: string }>;
  expire(intentId: string): Promise<void>;
}

const secret = () => process.env.FOOD_PAYMENT_WEBHOOK_SECRET || process.env.AUTH_SECRET || "";

export function signPaymentWebhook(raw: string): string {
  return "sha256=" + createHmac("sha256", secret()).update(raw).digest("hex");
}

function verifySignature(header: string | null, raw: string): boolean {
  if (!secret() || !header) return false;
  const expected = signPaymentWebhook(raw);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "https://nidokey.es")
    .replace(/^([^h])/, "https://$1")
    .replace(/\/+$/, "");
}

export const fakePaymentProvider: PaymentProvider = {
  async createIntent({ amountCents, currency, orderId, returnUrl }) {
    const intentId = `fake_${orderId}_${Date.now().toString(36)}`;
    const params = new URLSearchParams({
      intentId,
      orderId,
      amount: String(amountCents),
      currency,
      returnUrl,
    });
    return {
      intentId,
      checkoutUrl: `${baseUrl()}/food/pay/fake?${params.toString()}`,
    };
  },

  async verifyWebhook(req) {
    const raw = await req.text();
    if (!verifySignature(req.headers.get("x-nidokey-payment-signature"), raw)) return null;
    const payload = JSON.parse(raw) as {
      eventId?: string;
      type?: string;
      intentId?: string;
      amountCents?: number;
    };
    const amountCents = payload.amountCents;
    if (
      !payload.eventId ||
      !payload.intentId ||
      typeof amountCents !== "number" ||
      !Number.isInteger(amountCents) ||
      !["succeeded", "failed", "refunded"].includes(String(payload.type))
    ) {
      return null;
    }
    return {
      eventId: payload.eventId,
      type: payload.type as PaymentEvent["type"],
      intentId: payload.intentId,
      amountCents,
      payload,
    };
  },

  async getIntentStatus() {
    return "pending";
  },

  async refund(intentId) {
    return { refundId: `fake_refund_${intentId}_${Date.now().toString(36)}` };
  },

  async expire() {
    return;
  },
};

export function paymentProvider(provider: string): PaymentProvider | null {
  if (provider === "fake") return fakePaymentProvider;
  return null;
}
