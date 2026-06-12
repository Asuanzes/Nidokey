import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET() {
  const userId = await requireUserId();
  const [staffOf, courier] = await Promise.all([
    prisma.restaurantStaff.findMany({
      where: { userId },
      include: { restaurant: { select: { id: true, name: true, imageUrl: true, isOpen: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.courierProfile.findUnique({ where: { userId } }),
  ]);
  return NextResponse.json({
    staffOf: staffOf.map((s) => ({ id: s.restaurantId, role: s.role, restaurant: s.restaurant })),
    isCourier: !!courier?.active,
    courier,
  });
}
