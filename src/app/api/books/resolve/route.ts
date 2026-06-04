import { NextRequest, NextResponse } from "next/server";

import { getUserId } from "@/lib/auth-helpers";
import { resolveBookFromUrl, bookToNormalized } from "@/features/books/resolve";
import type { SearchHit } from "@/features/sources/types";

/**
 * POST /api/books/resolve  { url }
 *
 * Resuelve un libro desde la URL de una página de tienda usando el pipeline
 * robusto de src/features/books/resolve.ts (la página es solo una PISTA: se
 * extraen ISBN/título/autor de schema.org y se resuelven contra Google Books /
 * Open Library). Devuelve la misma forma que /api/records/search
 * (`{ results: SearchHit[] }`, con el NormalizedRecord embebido para importar sin
 * re-fetch) + `extracted`/`error` para diagnóstico.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado", results: [] }, { status: 401 });

  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = String(body?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body inválido", results: [] }, { status: 400 });
  }

  const result = await resolveBookFromUrl(url);
  if (!result.ok) {
    return NextResponse.json({ results: [], error: result.code, message: result.message, extracted: {} });
  }

  const record = bookToNormalized(result.book);
  const hit: SearchHit = {
    symbol: record.externalId ?? result.book.id,
    name: result.book.title || null,
    exchange: result.book.authors[0] ?? null,
    type: result.book.publishedYear?.toString() ?? null,
    record,
  };
  return NextResponse.json({ results: [hit], extracted: result.hints, via: result.via });
}
