import type { BaseRecord, Book } from "@nidokey/shared";

import { lookupBookByIsbn, normalizeIsbn, bookToNormalized } from "@/features/books/resolve";
import { upsertRecord, getBookById } from "@/features/sources/upsert";
import { bookToBaseRecord } from "@/lib/records/mapper";

/**
 * Servicio de alta de un libro por ISBN — el caso "código de barras del libro
 * físico". Reutiliza el MISMO pipeline que el alta por URL/manual, simplificado al
 * caso ISBN directo: normaliza → resuelve (Google Books + Open Library vía
 * `lookupBookByIsbn`) → persiste (`upsertRecord`) → devuelve la ficha
 * (`bookToBaseRecord`). Las dependencias de I/O se inyectan para poder testear sin red.
 */
export type ImportByIsbnErrorCode = "INVALID_ISBN" | "BOOK_NOT_FOUND" | "METADATA_LOOKUP_FAILED";

export type ImportByIsbnResult =
  | { ok: true; record: BaseRecord; status: "created" | "updated" }
  | { ok: false; code: ImportByIsbnErrorCode };

export type ImportByIsbnDeps = {
  lookupByIsbn: (isbn: string) => Promise<Book | null>;
  upsert: typeof upsertRecord;
  getById: typeof getBookById;
};

const defaultDeps: ImportByIsbnDeps = {
  lookupByIsbn: lookupBookByIsbn,
  upsert: upsertRecord,
  getById: getBookById,
};

export async function importBookByIsbn(
  isbn: string,
  ownerId: string,
  deps: ImportByIsbnDeps = defaultDeps
): Promise<ImportByIsbnResult> {
  // 1) Validar/normalizar (acepta EAN-13 / ISBN-10, con o sin guiones).
  const norm = normalizeIsbn(isbn);
  if (!norm) return { ok: false, code: "INVALID_ISBN" };

  // 2) Resolver por ISBN (Open Library → Google Books). lookupBookByIsbn
  //    devuelve null si ningún proveedor tiene el libro, y LANZA
  //    BookProvidersUnavailableError si no hay resultado y algún proveedor
  //    estaba caído/sin cuota → aquí se traduce a METADATA_LOOKUP_FAILED
  //    (502, reintentable) en vez de mentir con BOOK_NOT_FOUND.
  let book: Book | null;
  try {
    book = await deps.lookupByIsbn(norm);
  } catch {
    return { ok: false, code: "METADATA_LOOKUP_FAILED" };
  }
  if (!book) return { ok: false, code: "BOOK_NOT_FOUND" };

  // 3) Persistir + devolver la ficha normalizada (igual que /api/books/manual).
  try {
    const { id, created } = await deps.upsert(ownerId, bookToNormalized(book));
    const row = await deps.getById(id);
    if (!row) return { ok: false, code: "METADATA_LOOKUP_FAILED" };
    return { ok: true, record: bookToBaseRecord(row), status: created ? "created" : "updated" };
  } catch {
    return { ok: false, code: "METADATA_LOOKUP_FAILED" };
  }
}
