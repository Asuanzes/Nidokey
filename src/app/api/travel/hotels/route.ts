import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { liteHotelsByCity, liteHotelsByCoords, liteHotelRates, type LiteHotel } from "@/features/sources/providers/liteapi";

/**
 * GET /api/travel/hotels?countryCode=ES&cityName=Barcelona&checkin=...&checkout=...
 * Hoteles con PRECIO REAL (LiteAPI): liteHotelsByCity → ids; liteHotelRates →
 * tarifas. Extrae el precio retail más barato por hotel (lo que paga el usuario)
 * y construye el enlace de reserva (white-label nuitee). Owner-scoped.
 *
 * IMPORTANTE: el `margin` (% que ganamos) es INTERNO — va a LiteAPI para que el
 * retail ya lo incluya, pero NO se devuelve al cliente. El usuario solo ve el
 * precio retail. La comisión nunca se expone.
 */
const Query = z.object({
  // Coordenadas (preferente, independiente del idioma) o countryCode+cityName.
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  countryCode: z.string().min(2).max(2).optional(),
  cityName: z.string().min(1).optional(),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(8).optional(),
});

/** % de margen interno (monetización) que LiteAPI baja al precio retail. */
const HOTEL_MARGIN_PCT = 6;

type RateRow = {
  hotelId: string;
  roomTypes?: { rates?: { retailRate?: { total?: { amount?: number }[] } }[] }[];
};

/** Precio retail mínimo del hotel en céntimos (o null si no hay tarifa). */
function cheapestRetailCents(row: RateRow): number | null {
  let min: number | null = null;
  for (const rt of row.roomTypes ?? []) {
    for (const r of rt.rates ?? []) {
      const amount = r.retailRate?.total?.[0]?.amount;
      if (typeof amount === "number") {
        const cents = Math.round(amount * 100);
        if (min == null || cents < min) min = cents;
      }
    }
  }
  return min;
}

/** Base del white-label de reserva (LiteAPI/Nuitee). El de prueba del usuario. */
function whiteLabelBase(): string {
  return (
    process.env.LITEAPI_WHITELABEL_URL?.trim() ||
    "https://alejandro-suances-isz5h.nuitee.link"
  ).replace(/\/+$/, "");
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
  const { lat, lng, countryCode, cityName, checkin, checkout, adults } = parsed.data;
  if ((lat == null || lng == null) && (!countryCode || !cityName)) {
    return NextResponse.json(
      { error: "Falta destino: lat/lng o countryCode+cityName" },
      { status: 400 }
    );
  }
  try {
    // Coordenadas preferente (robusto con nombres localizados: "Londres" vs "London").
    const hotels =
      lat != null && lng != null
        ? await liteHotelsByCoords({ lat, lng, limit: 15 })
        : await liteHotelsByCity({ countryCode: countryCode!, cityName: cityName!, limit: 15 });
    // 0 hoteles = destino sin datos (cobertura limitada en sandbox).
    if (hotels.length === 0) return NextResponse.json({ items: [], reason: "no_city" });

    const byId = new Map<string, LiteHotel>(hotels.map((h) => [h.id, h]));
    const rates = (await liteHotelRates({
      hotelIds: hotels.map((h) => h.id),
      checkin,
      checkout,
      adults: adults ?? 2,
      currency: "EUR",
      margin: HOTEL_MARGIN_PCT, // interno; NO se devuelve al cliente
    })) as RateRow[];

    const wl = whiteLabelBase();
    const items = rates
      .map((row) => {
        const h = byId.get(row.hotelId);
        const priceCents = cheapestRetailCents(row);
        if (!h || priceCents == null) return null;
        return {
          hotelId: h.id,
          name: h.name ?? "Hotel",
          stars: h.stars ?? null,
          thumbnail: h.thumbnail ?? h.main_photo ?? null,
          city: h.city ?? cityName ?? null,
          country: h.country ?? countryCode ?? null,
          lat: h.latitude ?? null,
          lng: h.longitude ?? null,
          priceCents, // precio RETAIL al usuario (sin desglose de comisión)
          currency: "EUR",
          // White-label de reserva (in-app browser). Pre-relleno básico; el
          // deep-link exacto por hotel se afina más adelante.
          bookUrl: `${wl}/?language=es&currency=EUR&checkin=${checkin}&checkout=${checkout}`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.priceCents - b.priceCents);

    // Hay hoteles en el catálogo pero ninguno con tarifa para esas fechas.
    if (items.length === 0) return NextResponse.json({ items: [], reason: "no_rates" });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[travel-hotels] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
