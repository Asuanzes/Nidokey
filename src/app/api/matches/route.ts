import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET() {
  const ownerId = await requireUserId();
  // IDs del usuario
  const myProps = await prisma.property.findMany({
    where: { ownerId },
    select: { id: true },
  });
  if (myProps.length === 0) return NextResponse.json({ items: [] });
  const myIds = myProps.map((p) => p.id);

  const suggestions = await prisma.matchSuggestion.findMany({
    where: { dismissedAt: null, score: { gte: 60 }, sourceId: { in: myIds } },
    orderBy: { score: "desc" },
    take: 100,
  });
  if (suggestions.length === 0) return NextResponse.json({ items: [] });

  const ids = Array.from(new Set(suggestions.flatMap((s) => [s.sourceId, s.targetId])));
  const props = await prisma.property.findMany({
    where: { id: { in: ids }, ownerId },
    include: {
      media: { take: 1, where: { kind: "PHOTO" }, orderBy: { order: "asc" } },
      listings: { select: { portal: true, url: true } },
    },
  });
  const byId = new Map(props.map((p) => [p.id, p]));

  const items = suggestions
    .filter((s) => byId.has(s.sourceId) && byId.has(s.targetId))
    .map((s) => ({
      id: s.id,
      score: s.score,
      reasons: s.reasons,
      createdAt: s.createdAt,
      source: byId.get(s.sourceId),
      target: byId.get(s.targetId),
    }));
  return NextResponse.json({ items });
}
