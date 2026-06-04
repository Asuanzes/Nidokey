import { fromOpenLibrary, createBook, type Book } from "@nidokey/shared";
import type {
  FetchOutcome,
  NormalizedRecord,
  SearchHit,
  SourceAdapter,
  SourceInput,
} from "@/features/sources/types";
import {
  openLibrarySearch,
  openLibraryWork,
} from "@/features/sources/providers/open-library";

/**
 * Adaptador de LIBROS vía Open Library — SIN clave (keyless), fallback de Google
 * Books. La búsqueda ya trae portada/autor/año/ISBN/rating (no la sinopsis), y
 * el candidato viaja con su `NormalizedRecord` embebido (import directo, coste 0).
 * El `fetch` directo por work id sí trae la sinopsis (work API).
 */
const SOURCE = "open_library";

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
    externalId: book.externalIds.openLibraryWorkId ?? book.id,
    observedAt: new Date(),
    meta: { book, authors: book.authors.join(", "), isbn13: book.isbn13 ?? null },
  };
}

/** La sinopsis del work puede ser string o `{ value }`. */
function descriptionOf(work: unknown): string | null {
  const d = (work as { description?: unknown })?.description;
  const txt =
    typeof d === "string"
      ? d
      : typeof (d as { value?: unknown })?.value === "string"
      ? ((d as { value: string }).value)
      : null;
  return txt ? txt.replace(/\s+/g, " ").trim() || null : null;
}

export const openLibraryAdapter: SourceAdapter = {
  type: "book",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "symbol";
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "symbol") {
      return { kind: "error", error: "Libros requiere un id de Open Library" };
    }
    const id = input.symbol.replace(/^openlib:/i, "").trim();
    try {
      const work = await openLibraryWork(id);
      if (!work) return { kind: "gone", reason: `Libro no encontrado: ${id}` };
      const w = work as { title?: string };
      const book = createBook({
        id: `openlib:${id}`,
        source: "OPEN_LIBRARY",
        title: w.title ?? "",
        externalIds: { openLibraryWorkId: id },
        description: descriptionOf(work),
        detailUrl: `https://openlibrary.org/works/${id}`,
      });
      return { kind: "ok", record: bookToNormalized(book) };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },

  async search(query: string): Promise<SearchHit[]> {
    const docs = await openLibrarySearch(query);
    return docs.map((doc): SearchHit => {
      const book = fromOpenLibrary(doc);
      return {
        symbol: book.externalIds.openLibraryWorkId ?? book.id,
        name: book.title || null,
        exchange: book.authors[0] ?? null,
        type: book.publishedYear?.toString() ?? null,
        record: bookToNormalized(book), // import directo, sin re-fetch
      };
    });
  },
};
