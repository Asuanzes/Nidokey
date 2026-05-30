import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { propertyToBaseRecord } from "@/lib/records/mapper";

/**
 * GET /api/records?type=property
 *
 * Endpoint UNIFICADO de registros. Hoy envuelve la consulta de inmuebles y la
 * devuelve como BaseRecord[]; mañana, al añadir tipos, se amplía aquí sin tocar
 * los clientes. Siempre owner-scoped (requireUserId + ownerId).
 *
 * NOTA: implementado pero NO desplegado ni consumido por la app móvil todavía
 * (la app sigue usando /api/properties vía el repositorio). Ver
 * docs/arquitectura-records.md.
 */
export async function GET(req: NextRequest) {
  const ownerId = await requireUserId();
  const type = (req.nextUrl.searchParams.get("type") ?? "property") as RecordType;

  if (type === "property") {
    const properties = await prisma.property.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      include: { media: { take: 1, orderBy: { order: "asc" } } },
      take: 100,
    });
    return NextResponse.json(properties.map(propertyToBaseRecord));
  }

  // Tipos reservados (crypto, job…): sin datos todavía.
  return NextResponse.json([]);
}
