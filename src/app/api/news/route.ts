import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { yahooNews, type NewsItem } from "@/features/sources/providers/yahoo-news";

export const maxDuration = 30;

/**
 * GET /api/news?type=crypto|market
 *
 * Noticias de los activos REGISTRADOS del usuario (owner-scoped): coge los
 * símbolos de sus cripto/instrumentos, pide el RSS de Yahoo de cada uno, agrega,
 * deduplica por URL y ordena por fecha. Caché en memoria por (owner,type) para
 * no pedir a Yahoo en cada apertura del sheet de noticias.
 */
const cache = new Map<string, { at: number; items: NewsItem[] }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const ownerId = await requireUserId();
  const type = req.nextUrl.searchParams.get("type");
  if (type !== "crypto" && type !== "market") {
    return NextResponse.json({ error: "type debe ser 'crypto' o 'market'" }, { status: 400 });
  }

  const key = `${ownerId}:${type}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ items: hit.items, cached: true });
  }

  // Símbolos Yahoo de los activos del usuario.
  let symbols: string[] = [];
  if (type === "crypto") {
    const holdings = await prisma.cryptoHolding.findMany({
      where: { ownerId },
      select: { symbol: true, quoteCurrency: true },
    });
    // Cripto en Yahoo: BTC-USD / BTC-EUR …
    symbols = holdings.map((h) => `${h.symbol.toUpperCase()}-${(h.quoteCurrency || "USD").toUpperCase()}`);
  } else {
    const instruments = await prisma.marketInstrument.findMany({
      where: { ownerId },
      select: { symbol: true },
    });
    // Mercado: el símbolo ya es el ticker de Yahoo (SXRV.DE, AAPL…). Anteponemos
    // índices de referencia con economía generalista en español, porque muchos
    // ETFs de nicho no tienen noticias propias en Yahoo y el sheet quedaría
    // vacío (igual que en cripto, donde los feeds ya traen generalista).
    symbols = ["^IBEX", "^STOXX50E", "^GSPC", ...instruments.map((i) => i.symbol)];
  }
  symbols = [...new Set(symbols)].slice(0, 15);

  // Noticias por símbolo (el throttle vive dentro de yahooNews).
  const collected: NewsItem[] = [];
  for (const s of symbols) {
    collected.push(...(await yahooNews(s)));
  }

  // Dedupe por URL · orden por fecha desc · cota.
  const seen = new Set<string>();
  const items = collected
    .filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true)))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 40);

  cache.set(key, { at: Date.now(), items });
  return NextResponse.json({ items });
}
