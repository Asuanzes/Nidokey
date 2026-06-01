import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import {
  propertyToBaseRecord,
  cryptoToBaseRecord,
  marketToBaseRecord,
} from "@/lib/records/mapper";

/**
 * GET /api/search?q=texto[&scope=all]
 *
 * - Sin scope (web GlobalSearch): proyección reducida de PROPIEDADES → { results }.
 * - scope=all (app móvil "Buscar en tus registros"): búsqueda UNIFICADA sobre
 *   propiedades + cripto + mercados → { results: BaseRecord[] }.
 *
 * Owner-scoped (requireUserId). Insensible a mayúsculas (Prisma insensitive).
 */
export async function GET(req: NextRequest) {
  const ownerId = await requireUserId();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ci = { contains: q, mode: "insensitive" as const };

  // ── Modo por defecto (web): solo propiedades, proyección ligera ──────────
  if (req.nextUrl.searchParams.get("scope") !== "all") {
    const results = await prisma.property.findMany({
      where: {
        ownerId,
        OR: [
          { title: ci },
          { city: ci },
          { neighborhood: ci },
          { address: ci },
          { cadastralRef: ci },
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

  // ── scope=all (móvil): propiedades + cripto + mercados → BaseRecord[] ─────
  const [props, cryptos, markets] = await Promise.all([
    prisma.property.findMany({
      where: {
        ownerId,
        OR: [
          { title: ci },
          { city: ci },
          { neighborhood: ci },
          { address: ci },
          { cadastralRef: ci },
        ],
      },
      take: 12,
      orderBy: { updatedAt: "desc" },
      include: {
        media: { take: 1, where: { kind: "PHOTO" }, orderBy: { order: "asc" }, select: { url: true } },
      },
    }),
    prisma.cryptoHolding.findMany({
      where: { ownerId, OR: [{ title: ci }, { subtitle: ci }, { symbol: ci }] },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.marketInstrument.findMany({
      where: { ownerId, OR: [{ title: ci }, { subtitle: ci }, { symbol: ci }] },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const results = [
    ...props.map(propertyToBaseRecord),
    ...cryptos.map(cryptoToBaseRecord),
    ...markets.map(marketToBaseRecord),
  ];
  return NextResponse.json({ results });
}
