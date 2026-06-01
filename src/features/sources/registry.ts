import type { RecordType } from "@nidokey/shared";
import type { SourceAdapter, SourceInput } from "@/features/sources/types";
import { coingeckoAdapter } from "@/features/sources/adapters/coingecko";
import { twelvedataAdapter } from "@/features/sources/adapters/twelvedata";

/**
 * Registro de adaptadores por tipo. Añadir una fuente = añadirla aquí.
 * Espejo del array ADAPTERS + pickAdapter de src/features/scraping/runner.ts.
 */
const REGISTRY: Partial<Record<RecordType, SourceAdapter[]>> = {
  crypto: [coingeckoAdapter],
  market: [twelvedataAdapter],
};

export function adaptersFor(type: RecordType): SourceAdapter[] {
  return REGISTRY[type] ?? [];
}

export function pickAdapter(type: RecordType, input: SourceInput): SourceAdapter | null {
  return adaptersFor(type).find((a) => a.identify(input)) ?? null;
}
