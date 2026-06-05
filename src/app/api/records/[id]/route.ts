import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { propertyToBaseRecord, cryptoToBaseRecord, marketToBaseRecord, jobToBaseRecord, bookToBaseRecord } from "@/lib/records/mapper";

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

  if (type === "market") {
    const instrument = await prisma.marketInstrument.findFirst({
      where: { id, ownerId },
      include: { snapshots: { orderBy: { observedAt: "asc" } } },
    });
    if (!instrument) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const record = marketToBaseRecord(instrument);
    return NextResponse.json({ ...record, meta: { ...record.meta, detail: instrument } });
  }

  if (type === "job") {
    const job = await prisma.jobListing.findFirst({
      where: { id, ownerId },
      include: { snapshots: { orderBy: { observedAt: "asc" } } },
    });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const record = jobToBaseRecord(job);
    return NextResponse.json({ ...record, meta: { ...record.meta, detail: job } });
  }

  if (type === "book") {
    const book = await prisma.bookRecord.findFirst({ where: { id, ownerId } });
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const record = bookToBaseRecord(book);
    return NextResponse.json({ ...record, meta: { ...record.meta, detail: book } });
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

/**
 * DELETE /api/records/:id?type=<tipo>
 *
 * Borra un registro del usuario. Owner-scoped vía `deleteMany({ id, ownerId })`
 * ⇒ 404 si no es del usuario (no se filtra existencia ajena). La cascada
 * (listings, snapshots, media) la aplican las relaciones del schema.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const type = (req.nextUrl.searchParams.get("type") ?? "property") as RecordType;

  if (type === "crypto") {
    const res = await prisma.cryptoHolding.deleteMany({ where: { id, ownerId } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (type === "market") {
    const res = await prisma.marketInstrument.deleteMany({ where: { id, ownerId } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (type === "job") {
    const res = await prisma.jobListing.deleteMany({ where: { id, ownerId } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (type === "book") {
    const res = await prisma.bookRecord.deleteMany({ where: { id, ownerId } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const res = await prisma.property.deleteMany({ where: { id, ownerId } });
  if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/records/:id?type=book  { notes }
 *
 * Guarda el COMENTARIO/nota del usuario para un libro en `meta.userNotes` — texto
 * propio, separado de la sinopsis del proveedor y a salvo de los re-imports (el
 * merge de upsertBook no toca userNotes). `notes` vacío borra la nota. Owner-scoped.
 * Por ahora solo libros.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const type = (req.nextUrl.searchParams.get("type") ?? "property") as RecordType;
  if (type !== "book") {
    return NextResponse.json({ error: "Solo los libros admiten notas por ahora" }, { status: 400 });
  }

  let body: { notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const raw = typeof body.notes === "string" ? body.notes.trim() : "";
  const notes = raw ? raw.slice(0, 4000) : null;

  const book = await prisma.bookRecord.findFirst({ where: { id, ownerId } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = { ...((book.meta as Record<string, unknown>) ?? {}) };
  if (notes) meta.userNotes = notes;
  else delete meta.userNotes;

  const updated = await prisma.bookRecord.update({
    where: { id: book.id },
    data: { meta: meta as object },
  });
  const record = bookToBaseRecord(updated);
  return NextResponse.json({ ...record, meta: { ...record.meta, detail: updated } });
}
