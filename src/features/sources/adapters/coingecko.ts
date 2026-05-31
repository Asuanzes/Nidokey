import type { FetchOutcome, SourceAdapter, SourceInput } from "@/features/sources/types";

/**
 * Adaptador de fuente para CRIPTO vía CoinGecko (API pública, sin clave).
 *
 * - Ingesta (fetch): símbolo "BTC" → resuelve a id "bitcoin" (search) → precio
 *   (simple/price) → NormalizedRecord.
 * - Refresh: `batchPrices(ids, quote)` actualiza MUCHAS posiciones en 1 llamada
 *   (clave para no agotar la free tier).
 *
 * Throttle module-level (como src/lib/geocode.ts) para respetar el rate-limit.
 */

const BASE = "https://api.coingecko.com/api/v3";
const UA = "Nidokey/1.0 (personal record tracker)";
const MIN_INTERVAL_MS = 1500; // ~ free tier friendly
let lastCall = 0;

async function throttle() {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function cgFetch(path: string): Promise<unknown> {
  await throttle();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status} en ${path}`);
  return res.json();
}

type SearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb?: string;
  large?: string;
};

/** Resuelve un símbolo (BTC) a la moneda más relevante de CoinGecko. */
async function resolveCoin(symbol: string): Promise<SearchCoin | null> {
  const data = (await cgFetch(`/search?query=${encodeURIComponent(symbol)}`)) as {
    coins?: SearchCoin[];
  };
  const coins = data.coins ?? [];
  if (coins.length === 0) return null;
  const sym = symbol.trim().toUpperCase();
  const exact = coins.filter((c) => c.symbol?.toUpperCase() === sym);
  const pool = exact.length > 0 ? exact : coins;
  // menor market_cap_rank = más relevante (nulls al final)
  pool.sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9));
  return pool[0] ?? null;
}

export type CoinMarket = {
  priceCents: number;
  change24h: number | null; // % cambio 24h
  volume: number | null; // volumen 24h en la moneda cotizada
  marketCap: number | null;
  sparkline: number[]; // serie de precios 7d (downsampled)
  image: string | null;
  name: string;
  symbol: string;
};

/** Reduce una serie larga a ~n puntos equiespaciados (para el mini-gráfico). */
function downsample(arr: number[], n = 48): number[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

/**
 * Datos de mercado por id de CoinGecko en UNA llamada: precio, %24h, volumen,
 * market cap y sparkline 7d. Usado tanto en ingesta como en refresh (batch).
 */
export async function marketData(
  ids: string[],
  quote = "EUR"
): Promise<Record<string, CoinMarket>> {
  if (ids.length === 0) return {};
  const vs = quote.toLowerCase();
  const data = (await cgFetch(
    `/coins/markets?vs_currency=${vs}&ids=${ids.map(encodeURIComponent).join(",")}` +
      `&sparkline=true&price_change_percentage=24h`
  )) as Array<{
    id: string;
    symbol: string;
    name: string;
    image?: string;
    current_price: number | null;
    market_cap: number | null;
    total_volume: number | null;
    price_change_percentage_24h: number | null;
    sparkline_in_7d?: { price?: number[] };
  }>;
  const out: Record<string, CoinMarket> = {};
  for (const c of data) {
    if (c.current_price == null) continue;
    const series = (c.sparkline_in_7d?.price ?? []).filter((n) => typeof n === "number");
    out[c.id] = {
      priceCents: Math.round(c.current_price * 100),
      change24h: c.price_change_percentage_24h ?? null,
      volume: c.total_volume ?? null,
      marketCap: c.market_cap ?? null,
      sparkline: downsample(series),
      image: c.image ?? null,
      name: c.name,
      symbol: c.symbol?.toUpperCase() ?? "",
    };
  }
  return out;
}

export const coingeckoAdapter: SourceAdapter = {
  type: "crypto",
  source: "coingecko",

  identify(input: SourceInput): boolean {
    return input.kind === "symbol";
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "symbol") {
      return { kind: "error", error: "CoinGecko requiere un símbolo (ej. BTC)" };
    }
    const quote = (input.quote ?? "EUR").toUpperCase();
    try {
      const coin = await resolveCoin(input.symbol);
      if (!coin) return { kind: "gone", reason: `Símbolo no encontrado: ${input.symbol}` };

      const md = (await marketData([coin.id], quote))[coin.id];
      if (!md) return { kind: "error", error: `Sin datos de mercado para ${coin.id}/${quote}` };

      const symbol = (md.symbol || coin.symbol).toUpperCase();
      return {
        kind: "ok",
        record: {
          recordType: "crypto",
          title: md.name || coin.name,
          subtitle: `${symbol} · ${quote}`,
          status: "WATCH",
          currentValue: md.priceCents,
          currency: quote,
          imageUrl: md.image ?? coin.large ?? coin.thumb ?? null,
          source: "coingecko",
          externalId: coin.id,
          observedAt: new Date(),
          meta: {
            symbol,
            quoteCurrency: quote,
            coingeckoId: coin.id,
            priceRaw: md.priceCents / 100,
            change24h: md.change24h,
            volume: md.volume,
            marketCap: md.marketCap,
            sparkline: md.sparkline,
          },
        },
      };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
