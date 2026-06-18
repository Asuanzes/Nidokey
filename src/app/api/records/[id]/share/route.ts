import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { RecordType } from "@nidokey/shared";
import { normalizeUsername } from "@nidokey/shared";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Ctx = { params: Promise<{ id: string }> };

const RECORD_TYPES = ["property", "crypto", "market", "job", "book", "holiday"] as const;

const Body = z.object({
  type: z.enum(RECORD_TYPES),
  username: z.string().min(1),
});

/** ¿El registro (type,id) es del usuario? Owner-scoped por tipo. */
async function ownsRecord(type: RecordType, id: string, ownerId: string): Promise<boolean> {
  const where = { id, ownerId };
  switch (type) {
    case "crypto":
      return (await prisma.cryptoHolding.count({ where })) > 0;
    case "market":
      return (await prisma.marketInstrument.count({ where })) > 0;
    case "job":
      return (await prisma.jobListing.count({ where })) > 0;
    case "book":
      return (await prisma.bookRecord.count({ where })) > 0;
    case "holiday":
      return (await prisma.holiday.count({ where })) > 0;
    default:
      return (await prisma.property.count({ where })) > 0;
  }
}

/**
 * POST /api/records/:id/share  { type, username }
 *
 * Comparte un registro PROPIO con otro usuario (por su @username): le da acceso de
 * SOLO LECTURA al registro vivo (no es copia). Idempotente vía upsert sobre el
 * unique (recordType, recordId, toUserId). El propietario debe ser el dueño del
 * registro (si no, 404, sin filtrar existencia ajena).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const fromUserId = await requireUserId();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { type, username } = parsed.data;

  if (!(await ownsRecord(type, id, fromUserId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const handle = normalizeUsername(username);
  if (!handle) return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
  const target = await prisma.user.findUnique({
    where: { username: handle },
    select: { id: true, username: true, name: true },
  });
  if (!target) return NextResponse.json({ error: `No existe el usuario @${handle}` }, { status: 404 });
  if (target.id === fromUserId) {
    return NextResponse.json({ error: "No puedes compartir contigo mismo" }, { status: 400 });
  }

  await prisma.recordShare.upsert({
    where: { recordType_recordId_toUserId: { recordType: type, recordId: id, toUserId: target.id } },
    create: { recordType: type, recordId: id, fromUserId, toUserId: target.id },
    update: {},
  });

  return NextResponse.json({ ok: true, sharedWith: { username: target.username, name: target.name } });
}
