import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { haversineMeters } from "@nidokey/shared";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getCourierOrNull } from "@/lib/food/guard";
import { foodOrderDto } from "@/lib/food/service";

const Query = z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() });

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const courier = await getCourierOrNull(userId);
  if (!courier || !courier.active) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos", detail: parsed.error.flatten() }, { status: 400 });
  const orders = await prisma.foodOrder.findMany({
    where: { status: "READY", courierId: null },
    include: { restaurant: true, items: true, payment: true, events: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const withDistance = orders.map((o) => ({
    ...foodOrderDto(o),
    distanceM:
      parsed.data.lat != null && parsed.data.lng != null
        ? Math.round(haversineMeters(parsed.data.lat, parsed.data.lng, o.restaurant.latitude, o.restaurant.longitude))
        : null,
  }));
  return NextResponse.json({ orders: withDistance });
}
