import { NextRequest, NextResponse } from "next/server";
import { createBook, type Book } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { upsertRecord, getBookById } from "@/features/sources/upsert";
import { bookToBaseRecord } from "@/lib/records/mapper";
import type { NormalizedRecord } from "@/features/sources/types";

/**
 * POST /api/books/manual  { title, author?, isbn?, year?, imageUrl? }
 *
 * Alta MANUAL de un libro — LITERAL. Lo que el usuario escribe es EXACTAMENTE lo
 * que se guarda; NO se hace ninguna búsqueda que pueda "adivinar" otro libro
 * distinto (antes se intentaba Google Books y a veces colaba un título equivocado).
 * La portada es opcional y la ELIGE el usuario entre las sugerencias de
 * GET /api/books/cover; aquí solo se adjunta la `imageUrl` elegida.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: {
    title?: unknown;
    author?: unknown;
    isbn?: unknown;
    year?: unknown;
    imageUrl?: unknown;
  };
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
  const imageUrl =
    typeof body.imageUrl === "string" && /^https?:\/\//.test(body.imageUrl) ? body.imageUrl : null;
  if (title.length < 2) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  // LITERAL: el libro se crea EXACTAMENTE con lo que el usuario escribió. Nada de
  // buscar y "adivinar" otro título (antes podía colar el libro equivocado). La
  // portada es la que el usuario eligió entre las sugerencias (opcional).
  const id = isbn || `manual:${slugify(title)}${author ? "-" + slugify(author) : ""}`;
  const book: Book = createBook({
    id,
    source: "MANUAL",
    title,
    authors: author ? [author] : [],
    isbn13: isbn && isbn.length === 13 ? isbn : null,
    publishedYear: year,
    publishedDate: year ? String(year) : null,
    imageUrls: imageUrl ? { thumbnail: imageUrl, large: imageUrl } : {},
  });
  const normalized: NormalizedRecord = {
    recordType: "book",
    title,
    subtitle: [author, year ? String(year) : null].filter(Boolean).join(" · ") || null,
    status: "WISHLIST",
    currentValue: null,
    currency: null,
    imageUrl,
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
