import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { yahooChartSeries, type ChartRange } from "@/features/sources/providers/yahoo";

export const maxDuration = 20;

type Ctx = { params: Promise<{ id: string }> };

// Caché en memoria por (registro, rango): el histórico cambia poco minuto a
// minuto, así no pegamos a Yahoo en cada toque de pill.
const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 60 * 1000;

const RANGES: ChartRange[] = ["1D", "1S", "1M", "3M", "6M", "1A", "MAX"];

/**
 * GET /api/records/:id/chart?type=crypto|market&range=1D|1S|1M|3M|6M|1A|MAX
 *
 * Histórico REAL por rango (Yahoo) para el gráfico del detalle. Owner-scoped:
 * resuelve el símbolo Yahoo del activo del usuario (404 si no es suyo) y pide la
 * serie del rango. Unifica cripto (BTC-EUR) y mercado (AAPL, SXRV.DE) en Yahoo,
 * la misma fuente que ya usamos para precios/noticias.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const type = req.nextUrl.searchParams.get("type");
  const range = (req.nextUrl.searchParams.get("range") ?? "1S").toUpperCase() as ChartRange;

  if (type !== "crypto" && type !== "market") {
    return NextResponse.json({ error: "type debe ser 'crypto' o 'market'" }, { status: 400 });
  }
  if (!RANGES.includes(range)) {
    return NextResponse.json({ error: "range inválido" }, { status: 400 });
  }

  // Símbolo Yahoo del activo del usuario (owner-scoped ⇒ 404 si no es suyo).
  let yahooSymbol: string;
  if (type === "crypto") {
    const h = await prisma.cryptoHolding.findFirst({
      where: { id, ownerId },
      select: { symbol: true, quoteCurrency: true },
    });
    if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
    yahooSymbol = `${h.symbol.toUpperCase()}-${(h.quoteCurrency || "EUR").toUpperCase()}`;
  } else {
    const m = await prisma.marketInstrument.findFirst({
      where: { id, ownerId },
      select: { symbol: true },
    });
    if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
    yahooSymbol = m.symbol;
  }

  const key = `${id}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.body);
  }

  const series = await yahooChartSeries(yahooSymbol, range);
  const body = {
    range,
    symbol: yahooSymbol,
    currency: series.currency,
    previousClose: series.previousClose,
    points: series.points,
  };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}
