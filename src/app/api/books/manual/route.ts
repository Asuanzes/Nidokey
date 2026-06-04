import { NextRequest, NextResponse } from "next/server";
import { createBook, type Book } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { googleBooksAdapter } from "@/features/sources/adapters/google-books";
import { upsertRecord, getBookById } from "@/features/sources/upsert";
import { bookToBaseRecord } from "@/lib/records/mapper";
import type { NormalizedRecord } from "@/features/sources/types";

/**
 * POST /api/books/manual  { title, author?, isbn?, year? }
 *
 * Alta MANUAL de un libro — fallback final del híbrido: cuando ni el cliente ni
 * el resolver identifican el libro, el usuario lo mete a mano. Aún así intentamos
 * Google Books con lo introducido (ISBN exacto o título+autor): si está, se
 * guarda ESE (rico: portada y datos); si no, se crea un libro `source:"manual"`
 * con lo que escribió. Así NUNCA te quedas sin poder añadirlo.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { title?: unknown; author?: unknown; isbn?: unknown; year?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const title = String(body.title ?? "").trim();
  const author = String(body.author ?? "").trim();
  const isbn = normalizeIsbn(String(body.isbn ?? ""));
  const yearNum = Number(body.year);
  const year = Number.isInteger(yearNum) && yearNum > 1000 ? yearNum : null;
  if (title.length < 2) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  // 1) Intento Google Books con lo introducido (ISBN exacto o título+autor): si
  //    está, guardamos ESE (con portada y datos), no un manual pelado.
  try {
    const q = isbn ? `isbn:${isbn}` : [title, author].filter(Boolean).join(" ");
    const hits = await googleBooksAdapter.search!(q);
    if (hits[0]?.record) {
      const { id, created } = await upsertRecord(userId, hits[0].record);
      return respond(id, created);
    }
  } catch {
    /* Google caído → seguimos a manual */
  }

  // 2) No está en Google → libro MANUAL con lo que escribió el usuario.
  const id = isbn || `manual:${slugify(title)}${author ? "-" + slugify(author) : ""}`;
  const book: Book = createBook({
    id,
    source: "MANUAL",
    title,
    authors: author ? [author] : [],
    isbn13: isbn && isbn.length === 13 ? isbn : null,
    publishedYear: year,
    publishedDate: year ? String(year) : null,
  });
  const normalized: NormalizedRecord = {
    recordType: "book",
    title,
    subtitle: [author, year ? String(year) : null].filter(Boolean).join(" · ") || null,
    status: "WISHLIST",
    currentValue: null,
    currency: null,
    imageUrl: null,
    source: "manual",
    externalId: id,
    observedAt: new Date(),
    meta: { book, authors: author, isbn13: book.isbn13 },
  };
  const { id: rid, created } = await upsertRecord(userId, normalized);
  return respond(rid, created);
}

async function respond(id: string, created: boolean) {
  const row = await getBookById(id);
  if (!row) return NextResponse.json({ error: "No se pudo guardar el libro" }, { status: 500 });
  return NextResponse.json(
    { record: bookToBaseRecord(row), status: created ? "created" : "updated" },
    { status: created ? 201 : 200 },
  );
}

function normalizeIsbn(raw: string): string | null {
  const d = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(d)) return d;
  if (/^\d{9}[\dX]$/.test(d)) return d;
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
