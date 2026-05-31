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

/** Precios por id de CoinGecko en una sola llamada. Devuelve { id: cents }. */
export async function batchPrices(
  ids: string[],
  quote = "EUR"
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const vs = quote.toLowerCase();
  const data = (await cgFetch(
    `/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=${vs}`
  )) as Record<string, Record<string, number>>;
  const out: Record<string, number> = {};
  for (const id of ids) {
    const price = data[id]?.[vs];
    if (typeof price === "number") out[id] = Math.round(price * 100);
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

      const prices = await batchPrices([coin.id], quote);
      const cents = prices[coin.id];
      if (cents == null) {
        return { kind: "error", error: `Sin precio para ${coin.id}/${quote}` };
      }

      return {
        kind: "ok",
        record: {
          recordType: "crypto",
          title: coin.name,
          subtitle: `${coin.symbol.toUpperCase()} · ${quote}`,
          status: "WATCH",
          currentValue: cents,
          currency: quote,
          imageUrl: coin.large ?? coin.thumb ?? null,
          source: "coingecko",
          externalId: coin.id,
          observedAt: new Date(),
          meta: {
            symbol: coin.symbol.toUpperCase(),
            quoteCurrency: quote,
            coingeckoId: coin.id,
            priceRaw: cents / 100,
          },
        },
      };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },
};
