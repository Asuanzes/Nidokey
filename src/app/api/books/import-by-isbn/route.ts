import { NextRequest, NextResponse } from "next/server";

import { getUserId } from "@/lib/auth-helpers";
import { importBookByIsbn, type ImportByIsbnErrorCode } from "@/features/books/import-by-isbn";

/**
 * POST /api/books/import-by-isbn  { isbn }
 *
 * Alta de un libro a partir de su ISBN (caso "código de barras del libro físico").
 * Resuelve metadatos con el pipeline existente (Google Books + Open Library), lo
 * guarda en LIBROS y devuelve la ficha normalizada — mismo formato de respuesta que
 * /api/books/manual. Sin CORS (cliente móvil con Bearer, no bookmarklet).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUS: Record<ImportByIsbnErrorCode, number> = {
  INVALID_ISBN: 400,
  BOOK_NOT_FOUND: 404,
  METADATA_LOOKUP_FAILED: 502,
};
const MESSAGE: Record<ImportByIsbnErrorCode, string> = {
  INVALID_ISBN: "El ISBN debe tener 10 o 13 dígitos (con o sin guiones).",
  BOOK_NOT_FOUND: "No encontramos este libro en nuestros proveedores (Google Books / Open Library).",
  METADATA_LOOKUP_FAILED:
    "El servicio de libros no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.",
};

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let isbn = "";
  try {
    const body = (await req.json()) as { isbn?: unknown };
    isbn = String(body?.isbn ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const result = await importBookByIsbn(isbn, userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: MESSAGE[result.code], code: result.code, message: MESSAGE[result.code] },
      { status: STATUS[result.code] }
    );
  }
  return NextResponse.json(
    { record: result.record, status: result.status },
    { status: result.status === "created" ? 201 : 200 }
  );
}
