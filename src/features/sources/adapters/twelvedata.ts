import type { FetchOutcome, NormalizedRecord, SourceAdapter, SourceInput } from "@/features/sources/types";
import { tdQuote, tdSparkline, type TwelveQuote } from "@/features/sources/providers/twelvedata";

/**
 * Adaptador de MERCADOS (bolsa) vía Twelve Data (API oficial, free tier).
 * Por símbolo/ticker (AAPL, TSLA…), igual que cripto. Reutiliza las mismas
 * claves de `meta` que la tarjeta financiera (symbol/change24h/volume/sparkline)
 * para que la UI no necesite cambios.
 */
const SOURCE = "twelvedata";

function toCents(v?: string | number | null): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return n != null && Number.isFinite(n) ? Math.round(n * 100) : null;
}

function numOrNull(v?: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Reduce la serie a ~n puntos equiespaciados. */
function downsample(arr: number[], n = 30): number[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

function toNormalized(symbol: string, q: TwelveQuote, sparkline: number[]): NormalizedRecord | null {
  const priceCents = toCents(q.close);
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
      change24h: numOrNull(q.percent_change), // % cambio del día (reusa la key del card)
      volume: numOrNull(q.volume),
      marketCap: null, // Twelve Data free no lo expone
      sparkline: downsample(sparkline),
    },
  };
}

export const twelvedataAdapter: SourceAdapter = {
  type: "market",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "symbol";
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "symbol") {
      return { kind: "error", error: "Mercados requiere un símbolo (ej. AAPL)" };
    }
    const symbol = input.symbol.trim().toUpperCase();
    try {
      const q = await tdQuote(symbol);
      if (q.status === "error" || !q.close) {
        return { kind: "gone", reason: q.message || `Símbolo no encontrado: ${symbol}` };
      }
      const spark = await tdSparkline(symbol);
      const record = toNormalized(symbol, q, spark);
      if (!record) return { kind: "error", error: `Sin precio para ${symbol}` };
      return { kind: "ok", record };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
