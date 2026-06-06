import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { hotelsLookup } from "@/features/sources/providers/travelpayouts";

/**
 * GET /api/travel/places?q=Barcelona — autocomplete de DESTINO (vertical Viajes).
 * Envuelve el autocomplete de Travelpayouts. Devuelve ciudad con IATA y coords,
 * que el wizard usa para los pasos siguientes (vuelos por IATA, hoteles por
 * countryCode+cityName). Owner-scoped.
 */
const Query = z.object({ q: z.string().min(2, "mínimo 2 caracteres") });

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
  try {
    const places = await hotelsLookup(parsed.data.q, ["city"]);
    const items = places.map((p) => ({
      id: p.id,
      name: p.name,
      iata: p.code, // IATA ciudad ("BCN") → vuelos
      countryCode: p.country_code ?? null,
      countryName: p.country_name ?? null,
      cityName: p.name, // LiteAPI usa cityName + countryCode
      lat: p.coordinates?.lat ?? null,
      lng: p.coordinates?.lon ?? null,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[travel-places] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
