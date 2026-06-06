import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { flightPricesCheap } from "@/features/sources/providers/travelpayouts";

/**
 * GET /api/travel/flights?origin=MAD&destination=BCN&departDate=...&returnDate=...
 * Precio de vuelo (Travelpayouts Data API, cacheado). Coge el más barato del
 * bloque del destino. EUR → céntimos. Owner-scoped. Best-effort: si no hay datos
 * devuelve { item: null } (el wizard sigue sin vuelo).
 */
const Query = z.object({
  origin: z.string().min(3).max(3), // IATA ciudad ("MAD")
  destination: z.string().min(3).max(3),
  departDate: z.string().optional(), // "YYYY-MM-DD" | "YYYY-MM"
  returnDate: z.string().optional(),
});

type CheapEntry = {
  price?: number;
  airline?: string;
  flight_number?: number | string;
  departure_at?: string;
  return_at?: string;
};

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
  const { origin, destination, departDate, returnDate } = parsed.data;
  try {
    // La Data API cacheada de Travelpayouts tiene precios por MES, no por día
    // exacto: consultar "YYYY-MM-DD" devuelve casi siempre 0. Usamos el MES del
    // viaje → cubre muchas más rutas (el precio es indicativo; la reserva real va
    // a Aviasales con las fechas concretas).
    const departMonth = departDate ? departDate.slice(0, 7) : undefined;
    const returnMonth = returnDate ? returnDate.slice(0, 7) : undefined;
    const pick = (r: { data?: unknown }): CheapEntry[] =>
      Object.values(
        (r.data as Record<string, Record<string, CheapEntry>> | undefined)?.[destination.toUpperCase()] ?? {}
      ).filter((e): e is CheapEntry => typeof (e as CheapEntry)?.price === "number");

    // 1) Mes del viaje (más relevante).
    let entries = pick(
      await flightPricesCheap({ origin, destination, departDate: departMonth, returnDate: returnMonth, currency: "eur" })
    );
    // 2) Fallback: la caché de Travelpayouts es escasa por mes; si ese mes no
    //    tiene datos, pedimos el más barato de la ruta SIN fecha (indicativo).
    if (entries.length === 0) {
      entries = pick(await flightPricesCheap({ origin, destination, currency: "eur" }));
    }
    if (entries.length === 0) return NextResponse.json({ item: null });
    const cheapest = entries.reduce((a, b) => (a.price! <= b.price! ? a : b));
    const dep = departDate ? departDate.replace(/-/g, "").slice(2, 6) : ""; // DDMM-ish para deeplink
    const item = {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      priceCents: Math.round(cheapest.price! * 100),
      currency: "EUR",
      airline: cheapest.airline ?? null,
      flightNumber: cheapest.flight_number != null ? String(cheapest.flight_number) : null,
      departISO: cheapest.departure_at ?? null,
      returnISO: cheapest.return_at ?? null,
      // Búsqueda Aviasales (el marker de afiliado se añade en la capa de
      // monetización; el botón "Ver vuelo" abre esto en in-app browser).
      bookUrl: `https://www.aviasales.com/search/${origin.toUpperCase()}${dep}${destination.toUpperCase()}1`,
    };
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[travel-flights] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
