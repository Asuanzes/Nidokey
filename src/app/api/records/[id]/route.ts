import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { propertyToBaseRecord } from "@/lib/records/mapper";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/records/:id
 *
 * Devuelve un registro por id como BaseRecord, con su detalle de tipo en
 * `meta.detail`. Owner-scoped: `where: { id, ownerId }` ⇒ 404 si no es del
 * usuario (no se filtra existencia de registros ajenos).
 *
 * NOTA: implementado pero NO desplegado/consumido aún. La app móvil usa
 * /api/properties/:id vía fetchPropertyDetail.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();

  const property = await prisma.property.findFirst({
    where: { id, ownerId },
    include: {
      media: { orderBy: { order: "asc" } },
      listings: true,
      priceHistory: { orderBy: { observedAt: "asc" } },
    },
  });

  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const record = propertyToBaseRecord(property);
  return NextResponse.json({ ...record, meta: { ...record.meta, detail: property } });
}
