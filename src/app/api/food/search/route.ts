import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { haversineMeters } from "@nidokey/shared";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

const Query = z.object({
  q: z.string().min(2),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

export async function GET(req: NextRequest) {
  await requireUserId();
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { q, lat, lng } = parsed.data;
  const hits = await prisma.menuItem.findMany({
    where: {
      available: true,
      name: { contains: q.trim(), mode: "insensitive" },
      restaurant: { active: true, isOpen: true },
    },
    include: { restaurant: true },
    take: 80,
  });
  const results = hits
    .map((item) => ({
      item,
      restaurant: item.restaurant,
      distanceM: Math.round(haversineMeters(lat, lng, item.restaurant.latitude, item.restaurant.longitude)),
    }))
    .filter((r) => r.distanceM <= r.restaurant.deliveryRadiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 30);
  return NextResponse.json({ results });
}
