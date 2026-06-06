import { NextRequest, NextResponse } from "next/server";
import { dismissPairKey, type RecordType } from "@nidokey/shared";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

/**
 * POST /api/records/duplicates/dismiss  { type, ids[] }
 *
 * Marca un grupo como "no son duplicados": persiste TODOS los pares (idA|idB
 * ordenado) para que no vuelvan a agruparse. Owner-scoped e idempotente (upsert
 * por la unique [ownerId, pairKey]).
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ownerId = await requireUserId();

  let body: { type?: unknown; ids?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const DEDUP_TYPES: RecordType[] = ["book", "crypto", "market", "job"];
  const type = (typeof body.type === "string" ? body.type : "") as RecordType;
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((x): x is string => typeof x === "string" && !!x)))
    : [];

  if (!DEDUP_TYPES.includes(type) || ids.length < 2) {
    return NextResponse.json({ error: "type no válido o faltan al menos 2 ids" }, { status: 400 });
  }

  const pairs: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push(dismissPairKey(ids[i], ids[j]));
    }
  }

  await prisma.$transaction(
    pairs.map((pairKey) =>
      prisma.recordDuplicateDismissal.upsert({
        where: { ownerId_pairKey: { ownerId, pairKey } },
        create: { ownerId, recordType: type, pairKey },
        update: {},
      }),
    ),
  );

  return NextResponse.json({ ok: true, dismissed: pairs.length });
}
