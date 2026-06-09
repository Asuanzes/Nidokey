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
  // Libros (BÚSQUEDA fuzzy): Google Books PRIMERO (mejor ranking/datos) y Open
  // Library de respaldo. Desde B5-resiliencia los proveedores LANZAN cuando
  // están caídos/sin cuota (429) en vez de devolver vacío, así que la cadena de
  // /api/records/search cae a OL también con cuota agotada (antes solo con
  // respuesta vacía) y devuelve 502 honesto si AMBOS fallan. El lookup por ISBN
  // (resolve.ts) es OL-primero, que no gasta cuota de Google.
  book: [googleBooksAdapter, openLibraryAdapter],
};

export function adaptersFor(type: RecordType): SourceAdapter[] {
  return REGISTRY[type] ?? [];
}

export function pickAdapter(type: RecordType, input: SourceInput): SourceAdapter | null {
  return adaptersFor(type).find((a) => a.identify(input)) ?? null;
}
