import type { RecordType } from "@nidokey/shared";
import type { SourceAdapter, SourceInput } from "@/features/sources/types";
import { coingeckoAdapter } from "@/features/sources/adapters/coingecko";
import { yahooAdapter } from "@/features/sources/adapters/yahoo";

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
};

export function adaptersFor(type: RecordType): SourceAdapter[] {
  return REGISTRY[type] ?? [];
}

export function pickAdapter(type: RecordType, input: SourceInput): SourceAdapter | null {
  return adaptersFor(type).find((a) => a.identify(input)) ?? null;
}
