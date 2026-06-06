import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { requireUserId } from "@/lib/auth-helpers";
import { mergeRecords } from "@/features/dedup/merge";

/**
 * POST /api/records/duplicates/merge  { type, keepId, dropIds[] }
 *
 * Fusiona un grupo de duplicados: conserva `keepId`, vuelca lo que no degrade y
 * borra `dropIds`. Owner-scoped. Devuelve el superviviente como BaseRecord.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const ownerId = await requireUserId();

  let body: { type?: unknown; keepId?: unknown; dropIds?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const type = body.type as RecordType;
  const keepId = typeof body.keepId === "string" ? body.keepId : "";
  const dropIds = Array.isArray(body.dropIds)
    ? body.dropIds.filter((x): x is string => typeof x === "string")
    : [];

  if (!type || !keepId || dropIds.length === 0) {
    return NextResponse.json({ error: "Faltan type, keepId o dropIds" }, { status: 400 });
  }

  const res = await mergeRecords(ownerId, type, keepId, dropIds);
  if (!res.ok) {
    const status = res.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: "No se pudo fusionar", code: res.code }, { status });
  }
  return NextResponse.json({ record: res.record, deleted: res.deleted });
}
