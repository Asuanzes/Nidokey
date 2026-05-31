import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { propertyToBaseRecord, cryptoToBaseRecord } from "@/lib/records/mapper";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/records/:id?type=<tipo>
 *
 * Devuelve un registro por id como BaseRecord, con su detalle de tipo en
 * `meta.detail`. Owner-scoped: `where: { id, ownerId }` ⇒ 404 si no es del
 * usuario (no se filtra existencia de registros ajenos). `type` por defecto
 * "property".
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const type = (req.nextUrl.searchParams.get("type") ?? "property") as RecordType;

  if (type === "crypto") {
    const holding = await prisma.cryptoHolding.findFirst({
      where: { id, ownerId },
      include: { snapshots: { orderBy: { observedAt: "asc" } } },
    });
    if (!holding) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const record = cryptoToBaseRecord(holding);
    return NextResponse.json({ ...record, meta: { ...record.meta, detail: holding } });
  }

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
