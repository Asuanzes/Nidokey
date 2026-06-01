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
  | { kind: "query"; query: string };

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

/** Candidato de búsqueda (nombre/ticker → símbolo importable + su bolsa). */
export type SearchHit = {
  /** Identificador exacto para importar (ej. "JEDI.DE"). Vacío si el candidato
   *  ya trae sus datos en `record` (empleo). */
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null; // ETF | EQUITY | MUTUALFUND | INDEX…
  /**
   * Registro YA normalizado que viaja con el candidato. Para fuentes de pago
   * (empleo/Apify) la búsqueda es cara: en vez de re-llamar al elegir, el hit
   * lleva su `NormalizedRecord` y el import lo guarda tal cual (kind:"record").
   */
  record?: NormalizedRecord | null;
};

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
   * Busca candidatos por nombre/ticker/palabras clave (opcional). Habilita el
   * "buscar y elegir". `opts` permite filtros extra por tipo (p. ej. empleo:
   * ciudad/zona y remoto); las fuentes que no los usen los ignoran.
   */
  search?(query: string, opts?: SearchOpts): Promise<SearchHit[]>;
}

/** Filtros opcionales del buscador (los usa quien los soporte; ej. empleo). */
export type SearchOpts = { location?: string; remote?: boolean };
