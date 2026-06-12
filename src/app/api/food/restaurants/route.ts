import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { haversineMeters } from "@nidokey/shared";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

const Query = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  q: z.string().optional(),
  radiusM: z.coerce.number().int().positive().max(30000).default(6000),
});

export async function GET(req: NextRequest) {
  await requireUserId();
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { lat, lng, q, radiusM } = parsed.data;
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const rows = await prisma.restaurant.findMany({
    where: {
      active: true,
      latitude: { gte: lat - latDelta, lte: lat + latDelta },
      longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      ...(q?.trim()
        ? { OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, { description: { contains: q.trim(), mode: "insensitive" } }] }
        : {}),
    },
    take: 80,
  });
  const restaurants = rows
    .map((r) => ({ ...r, distanceM: Math.round(haversineMeters(lat, lng, r.latitude, r.longitude)) }))
    .filter((r) => r.distanceM <= Math.min(radiusM, r.deliveryRadiusM))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 30);
  return NextResponse.json({ restaurants });
}
