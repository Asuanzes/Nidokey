import { fromGoogleBooks, type Book } from "@nidokey/shared";
import type {
  FetchOutcome,
  NormalizedRecord,
  SearchHit,
  SourceAdapter,
  SourceInput,
} from "@/features/sources/types";
import {
  googleBooksSearch,
  googleBooksVolume,
} from "@/features/sources/providers/google-books";

/**
 * Adaptador de LIBROS vía Google Books. Importa por `volumeId` (kind:"symbol").
 *
 * La búsqueda es GRATIS y ya devuelve los datos completos del volumen, así que
 * el candidato (SearchHit) viaja con su `NormalizedRecord` embebido (como
 * empleo): al elegir se guarda sin re-llamar a la API (coste 0). El modelo de
 * dominio `Book` completo va en `meta.book` para que el detalle no dependa de
 * columnas. `currentValue` = rating medio * 100 (mismo contrato que el resto).
 */
const SOURCE = "google_books";

function bookToNormalized(book: Book): NormalizedRecord {
  const author = book.authors[0] ?? null;
  return {
    recordType: "book",
    title: book.title || "Libro",
    subtitle: [author, book.publishedYear].filter(Boolean).join(" · ") || null,
    status: "WISHLIST",
    currentValue: book.averageRating != null ? Math.round(book.averageRating * 100) : null,
    currency: null,
    imageUrl: book.imageUrls.thumbnail ?? book.imageUrls.large ?? null,
    source: SOURCE,
    externalId: book.externalIds.googleVolumeId ?? book.id,
    observedAt: new Date(),
    // El `Book` entero + claves denormalizadas para dedupe/orden en la tabla.
    meta: { book, authors: book.authors.join(", "), isbn13: book.isbn13 ?? null },
  };
}

export const googleBooksAdapter: SourceAdapter = {
  type: "book",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "symbol"; // symbol = volumeId de Google Books
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "symbol") {
      return { kind: "error", error: "Libros requiere un id de volumen de Google Books" };
    }
    const id = input.symbol.replace(/^gbooks:/, "").trim();
    try {
      const vol = await googleBooksVolume(id);
      if (!vol) return { kind: "gone", reason: `Libro no encontrado: ${id}` };
      return { kind: "ok", record: bookToNormalized(fromGoogleBooks(vol)) };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },

  async search(query: string): Promise<SearchHit[]> {
    const items = await googleBooksSearch(query);
    return items.map((vol): SearchHit => {
      const book = fromGoogleBooks(vol);
      return {
        symbol: book.externalIds.googleVolumeId ?? book.id,
        name: book.title || null,
        exchange: book.authors[0] ?? null, // autor → línea meta del candidato
        type: book.publishedYear?.toString() ?? null,
        record: bookToNormalized(book), // import directo, sin re-fetch
      };
    });
  },
};
