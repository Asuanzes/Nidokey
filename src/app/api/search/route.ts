import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ownerId = await requireUserId();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await prisma.property.findMany({
    where: {
      ownerId,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { neighborhood: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { cadastralRef: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 12,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      city: true,
      neighborhood: true,
      currentPrice: true,
      type: true,
      media: { take: 1, where: { kind: "PHOTO" }, orderBy: { order: "asc" }, select: { url: true } },
    },
  });
  return NextResponse.json({ results });
}
