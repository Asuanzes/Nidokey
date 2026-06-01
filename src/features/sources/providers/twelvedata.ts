/**
 * Cliente fino de Twelve Data (mercados de bolsa). La key (`TWELVEDATA_API_KEY`)
 * SOLO vive en el servidor (env). Free tier: 8 créditos/min, 800/día — 1 crédito
 * por llamada. Por eso throttle module-level (como coingecko.ts).
 *
 * Doc: https://twelvedata.com/docs
 */
const BASE = "https://api.twelvedata.com";
const MIN_INTERVAL_MS = 1500;
let lastCall = 0;

async function throttle() {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function apiKey(): string {
  const k = process.env.TWELVEDATA_API_KEY;
  if (!k) throw new Error("Falta TWELVEDATA_API_KEY en el entorno");
  return k;
}

async function tdFetch(path: string): Promise<unknown> {
  await throttle();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}apikey=${apiKey()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Twelve Data respondió ${res.status}`);
  return res.json();
}

export type TwelveQuote = {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
  status?: string; // "ok" | "error"
  code?: number;
  message?: string;
};

/** Cotización actual (precio, % cambio del día, volumen). */
export async function tdQuote(symbol: string): Promise<TwelveQuote> {
  return (await tdFetch(`/quote?symbol=${encodeURIComponent(symbol)}`)) as TwelveQuote;
}

/** Serie de cierres (para el mini-gráfico). Devuelve [] si falla. */
export async function tdSparkline(symbol: string, points = 30): Promise<number[]> {
  try {
    const data = (await tdFetch(
      `/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${points}`
    )) as { values?: Array<{ close?: string }>; status?: string };
    if (data.status !== "ok" || !Array.isArray(data.values)) return [];
    // values vienen del más reciente al más antiguo → invertir a cronológico.
    return data.values
      .map((v) => Number(v.close))
      .filter((n) => Number.isFinite(n))
      .reverse();
  } catch {
    return [];
  }
}
