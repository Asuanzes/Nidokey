import type {
  FetchOutcome,
  NormalizedRecord,
  SearchHit,
  SourceAdapter,
  SourceInput,
} from "@/features/sources/types";
import { yahooQuote, yahooSearch, type YahooQuote } from "@/features/sources/providers/yahoo";

/**
 * Adaptador de MERCADOS (bolsa) vía Yahoo Finance (no oficial, sin clave).
 * Por símbolo/ticker con sufijo de mercado para Europa: AAPL, SXR8.DE,
 * JEDI.DE, CSPX.L… Reutiliza las mismas claves de `meta` que la tarjeta
 * financiera (symbol/exchange/quoteCurrency/change24h/volume/sparkline) para
 * que la UI no necesite cambios. Moneda nativa del instrumento (EUR/USD…).
 */
const SOURCE = "yahoo";

function toCents(v: number): number | null {
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

function toNormalized(symbol: string, q: YahooQuote): NormalizedRecord | null {
  const priceCents = toCents(q.price);
  if (priceCents == null) return null;
  const currency = q.currency || "USD";
  const ticker = (q.symbol || symbol).toUpperCase();
  return {
    recordType: "market",
    title: q.name || ticker,
    subtitle: [ticker, q.exchange].filter(Boolean).join(" · ") || ticker,
    status: "WATCH",
    currentValue: priceCents,
    currency,
    imageUrl: null,
    source: SOURCE,
    externalId: ticker,
    observedAt: new Date(),
    meta: {
      symbol: ticker,
      exchange: q.exchange ?? null,
      quoteCurrency: currency,
      change24h: q.changePercent, // % del día (reusa la key del card)
      volume: q.volume,
      marketCap: null, // Yahoo chart no lo expone aquí
      sparkline: q.sparkline,
      instrumentType: q.instrumentType ?? null,
    },
  };
}

export const yahooAdapter: SourceAdapter = {
  type: "market",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "symbol";
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "symbol") {
      return { kind: "error", error: "Mercados requiere un símbolo (ej. AAPL, SXR8.DE)" };
    }
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const q = await yahooQuote(symbol);
      if (!q) {
        return { kind: "gone", reason: `Símbolo no encontrado: ${symbol}` };
      }
      const record = toNormalized(symbol, q);
      if (!record) return { kind: "error", error: `Sin precio para ${symbol}` };
      return { kind: "ok", record };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },

  async search(query: string): Promise<SearchHit[]> {
    return yahooSearch(query);
  },
};
