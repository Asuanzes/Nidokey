import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { flightPricesCheap } from "@/features/sources/providers/travelpayouts";
import { duffelSearchOffers, cheapestOffer } from "@/features/sources/providers/duffel";

/**
 * GET /api/travel/flights?origin=MAD&destination=BCN&departDate=...&returnDate=...
 *
 * Precio de vuelo. PRIMARIO: Duffel (búsqueda en vivo, cualquier ruta/fecha, EUR).
 * RESPALDO: Travelpayouts Data API cacheada (rutas populares) si Duffel falla o no
 * tiene token. La RESERVA va por enlace afiliado de Aviasales (marker en la capa
 * de monetización) — el botón abre eso en in-app browser. Owner-scoped.
 */
const Query = z.object({
  origin: z.string().min(3).max(3),
  destination: z.string().min(3).max(3),
  departDate: z.string().optional(),
  returnDate: z.string().optional(),
});

type FlightItem = {
  origin: string;
  destination: string;
  priceCents: number;
  currency: string;
  airline: string | null;
  flightNumber: string | null;
  departISO: string | null;
  returnISO: string | null;
  bookUrl: string;
};

type CheapEntry = {
  price?: number;
  airline?: string;
  flight_number?: number | string;
  departure_at?: string;
  return_at?: string;
};

/** Enlace de búsqueda Aviasales (afiliado/marker en la capa de monetización). */
function aviasalesUrl(origin: string, destination: string, departDate?: string): string {
  const dep = departDate ? departDate.replace(/-/g, "").slice(2, 6) : ""; // DDMM-ish
  return `https://www.aviasales.com/search/${origin}${dep}${destination}1`;
}

export async function GET(req: NextRequest) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const origin = parsed.data.origin.toUpperCase();
  const destination = parsed.data.destination.toUpperCase();
  const { departDate, returnDate } = parsed.data;
  const bookUrl = aviasalesUrl(origin, destination, departDate);

  // 1) PRIMARIO — Duffel (en vivo, fechas exactas, cualquier ruta).
  if (departDate) {
    try {
      const offers = await duffelSearchOffers({ origin, destination, departDate, returnDate, adults: 1 });
      const best = cheapestOffer(offers);
      if (best) {
        const seg = best.slices?.[0]?.segments?.[0];
        const retSeg = best.slices?.[1]?.segments?.[0];
        const item: FlightItem = {
          origin,
          destination,
          priceCents: Math.round(parseFloat(best.total_amount) * 100),
          currency: best.total_currency || "EUR",
          airline: best.owner?.name ?? seg?.marketing_carrier?.name ?? null,
          flightNumber:
            seg?.marketing_carrier?.iata_code && seg?.marketing_carrier_flight_number
              ? `${seg.marketing_carrier.iata_code} ${seg.marketing_carrier_flight_number}`
              : null,
          departISO: seg?.departing_at ?? null,
          returnISO: retSeg?.departing_at ?? null,
          bookUrl,
        };
        return NextResponse.json({ item });
      }
    } catch (err) {
      console.error("[travel-flights] duffel:", err instanceof Error ? err.message : err);
      // sigue al respaldo
    }
  }

  // 2) RESPALDO — Travelpayouts cacheado (rutas populares). Precio por MES; si el
  //    mes no tiene caché, el más barato de la ruta (indicativo).
  try {
    const pick = (r: { data?: unknown }): CheapEntry[] =>
      Object.values((r.data as Record<string, Record<string, CheapEntry>> | undefined)?.[destination] ?? {}).filter(
        (e): e is CheapEntry => typeof (e as CheapEntry)?.price === "number"
      );
    const departMonth = departDate ? departDate.slice(0, 7) : undefined;
    const returnMonth = returnDate ? returnDate.slice(0, 7) : undefined;
    let entries = pick(
      await flightPricesCheap({ origin, destination, departDate: departMonth, returnDate: returnMonth, currency: "eur" })
    );
    if (entries.length === 0) entries = pick(await flightPricesCheap({ origin, destination, currency: "eur" }));
    if (entries.length === 0) return NextResponse.json({ item: null });
    const cheapest = entries.reduce((a, b) => (a.price! <= b.price! ? a : b));
    const item: FlightItem = {
      origin,
      destination,
      priceCents: Math.round(cheapest.price! * 100),
      currency: "EUR",
      airline: cheapest.airline ?? null,
      flightNumber: cheapest.flight_number != null ? String(cheapest.flight_number) : null,
      departISO: cheapest.departure_at ?? null,
      returnISO: cheapest.return_at ?? null,
      bookUrl,
    };
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[travel-flights] travelpayouts:", err instanceof Error ? err.message : err);
    return NextResponse.json({ item: null });
  }
}
