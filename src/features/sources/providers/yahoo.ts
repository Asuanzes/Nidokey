/**
 * Cliente fino de Yahoo Finance (NO oficial, sin clave) para mercados:
 * acciones, ETFs y fondos de cualquier bolsa — incluida la europea con sufijo
 * de mercado: .DE (Xetra), .AS (Ámsterdam), .L (Londres), .PA (París),
 * .MI (Milán), .SW (Suiza), .MC (BME)…
 *
 * Endpoint público v8/chart: UNA llamada por símbolo devuelve precio en vivo,
 * % del día, volumen y la serie para el sparkline. Sin cuota dura (al revés que
 * Twelve Data), pero puede dar 429 si se le aprieta → throttle suave + User-Agent.
 *
 * Es API NO oficial (sin SLA, ToS gris): aceptable para un tracker personal.
 * `cache: "no-store"` evita que Next.js cachee cotizaciones.
 */
const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// Throttle a nivel de módulo (1 proceso): respeta a Yahoo y evita 429.
let lastCall = 0;
async function throttle(ms = 400): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Reduce la serie a ~n puntos equiespaciados. */
function downsample(arr: number[], n = 30): number[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

export type YahooQuote = {
  symbol: string;
  name: string | null;
  currency: string | null;
  exchange: string | null; // fullExchangeName (XETRA, NasdaqGS…)
  instrumentType: string | null; // EQUITY | ETF | MUTUALFUND | INDEX…
  price: number; // en unidades de `currency` (NO céntimos)
  changePercent: number | null; // % del día
  volume: number | null;
  sparkline: number[]; // cierres ~1 mes (downsampled)
};

type YahooChartMeta = {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  chartPreviousClose?: number;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
};

/** Cotización + serie en UNA sola llamada (range=1mo, velas diarias). */
export async function yahooQuote(symbol: string): Promise<YahooQuote | null> {
  await throttle();
  const url = `${CHART}/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as YahooChartResponse;
  const r = json.chart?.result?.[0];
  const m = r?.meta;
  if (!m) return null;
  const price = Number(m.regularMarketPrice);
  if (!Number.isFinite(price)) return null;

  const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
    (n): n is number => typeof n === "number"
  );
  // % del día = precio vs cierre anterior (penúltimo de la serie diaria).
  const prev =
    closes.length >= 2 ? closes[closes.length - 2] : Number(m.chartPreviousClose);
  const changePercent =
    Number.isFinite(prev) && prev ? round2(((price - prev) / prev) * 100) : null;
  const vol = m.regularMarketVolume;

  return {
    symbol: (m.symbol ?? symbol).toUpperCase(),
    name: m.longName ?? m.shortName ?? null,
    currency: m.currency ?? null,
    exchange: m.fullExchangeName ?? m.exchangeName ?? null,
    instrumentType: m.instrumentType ?? null,
    price,
    changePercent,
    volume: vol != null && Number.isFinite(Number(vol)) ? Number(vol) : null,
    sparkline: downsample(closes, 30),
  };
}

export type YahooSearchHit = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null;
};

/**
 * Búsqueda por nombre o ticker → símbolos con su bolsa. Habilita la UX
 * "buscar y elegir" (p. ej. "vaneck space" → JEDI.DE) para no tener que saberse
 * el sufijo de mercado. Solo instrumentos cotizados.
 */
export async function yahooSearch(query: string): Promise<YahooSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await throttle();
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    quotes?: Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      exchDisp?: string;
      quoteType?: string;
    }>;
  };
  const KEEP = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX", "CURRENCY"]);
  return (json.quotes ?? [])
    .filter((x) => x.symbol && x.quoteType && KEEP.has(x.quoteType))
    .map((x) => ({
      symbol: x.symbol!,
      name: x.shortname ?? x.longname ?? null,
      exchange: x.exchDisp ?? null,
      type: x.quoteType ?? null,
    }));
}
