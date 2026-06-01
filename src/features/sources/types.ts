import type { RecordType } from "@nidokey/shared";

/**
 * Framework de fuentes (sources) — generaliza el PortalAdapter de scraping a
 * cualquier tipo de registro y cualquier fuente (API o scrape).
 *
 * La entrada puede ser una URL (inmueble, producto) o un símbolo (cripto,
 * mercado). La salida es un registro normalizado. Conserva la unión
 * discriminada ok|gone|blocked|error del scraping.
 */

export type SourceInput =
  | { kind: "url"; url: string }
  | { kind: "symbol"; symbol: string; quote?: string } // cripto / mercado
  | { kind: "query"; query: string }
  | { kind: "search"; what: string; where?: string } // agregadores (empleo, viajes…)
  | { kind: "record"; record: NormalizedRecord }; // candidato ya normalizado a registrar

/** Registro normalizado que devuelve cualquier adaptador (superset común). */
export type NormalizedRecord = {
  recordType: RecordType;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  /** Valor actual en céntimos de `currency`. */
  currentValue?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  source: string; // clave del adaptador (ej. "coingecko")
  externalId?: string | null;
  observedAt: Date;
  meta?: Record<string, unknown>;
};

export type FetchOutcome =
  | { kind: "ok"; record: NormalizedRecord }
  | { kind: "gone"; reason: string }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; error: string };

export interface SourceAdapter {
  /** Tipo de registro que alimenta este adaptador. */
  readonly type: RecordType;
  /** Clave estable que se guarda en `source` (ej. "coingecko"). */
  readonly source: string;
  /** Anti-bot fuerte → el cron lo salta; requiere captura por cliente/WebView. */
  readonly manualOnly?: boolean;
  /** ¿Puede este adaptador manejar esta entrada? */
  identify(input: SourceInput): boolean;
  /** Trae + normaliza. No lanza; devuelve outcome. */
  fetch(input: SourceInput, ctx?: { previousValue?: number | null }): Promise<FetchOutcome>;
  /**
   * Búsqueda en agregadores (empleo, viajes…): devuelve VARIOS candidatos para
   * que el usuario elija cuál registrar. Opcional (solo fuentes tipo buscador).
   */
  search?(input: { what: string; where?: string }): Promise<NormalizedRecord[]>;
}
