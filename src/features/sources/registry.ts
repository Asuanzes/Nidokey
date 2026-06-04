import type { RecordType } from "@nidokey/shared";
import type { SourceAdapter, SourceInput } from "@/features/sources/types";
import { coingeckoAdapter } from "@/features/sources/adapters/coingecko";
import { yahooAdapter } from "@/features/sources/adapters/yahoo";
import { apifyJobsAdapter } from "@/features/sources/jobs/adapter";
import { googleBooksAdapter } from "@/features/sources/adapters/google-books";
import { openLibraryAdapter } from "@/features/sources/adapters/open-library";

/**
 * Registro de adaptadores por tipo. Añadir una fuente = añadirla aquí.
 * Espejo del array ADAPTERS + pickAdapter de src/features/scraping/runner.ts.
 *
 * Mercados: Yahoo Finance (cubre bolsas europeas: SXR8.DE, JEDI.DE…). Twelve
 * Data queda aparcado en adapters/twelvedata.ts (free es US-only) por si más
 * adelante se quiere US en tiempo real.
 */
const REGISTRY: Partial<Record<RecordType, SourceAdapter[]>> = {
  crypto: [coingeckoAdapter],
  market: [yahooAdapter],
  job: [apifyJobsAdapter],
  // Libros: Google Books PRIMERO (mejor datos) si hay GOOGLE_BOOKS_API_KEY; si su
  // búsqueda viene vacía (sin clave = cuota 0), la ruta de búsqueda cae a Open
  // Library (sin clave). Así funciona HOY y se "auto-mejora" al poner la key.
  book: [googleBooksAdapter, openLibraryAdapter],
};

export function adaptersFor(type: RecordType): SourceAdapter[] {
  return REGISTRY[type] ?? [];
}

export function pickAdapter(type: RecordType, input: SourceInput): SourceAdapter | null {
  return adaptersFor(type).find((a) => a.identify(input)) ?? null;
}
