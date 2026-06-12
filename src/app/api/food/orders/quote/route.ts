import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { quoteFoodOrder } from "@/lib/food/service";

const Body = z.object({
  restaurantId: z.string().min(1),
  items: z.array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().positive().max(20), notes: z.string().max(280).optional().nullable() })).min(1),
});

export async function POST(req: Request) {
  await requireUserId();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const quote = await quoteFoodOrder(parsed.data.restaurantId, parsed.data.items);
    return NextResponse.json({
      items: quote.items,
      subtotalCents: quote.subtotalCents,
      deliveryFeeCents: quote.deliveryFeeCents,
      totalCents: quote.totalCents,
      currency: quote.currency,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo calcular el pedido" }, { status: 400 });
  }
}
