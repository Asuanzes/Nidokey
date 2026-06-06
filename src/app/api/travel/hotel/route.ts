import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { liteHotelDetails, liteHotelRates } from "@/features/sources/providers/liteapi";

/**
 * GET /api/travel/hotel?hotelId=…&checkin=…&checkout=…&occupancies=…
 *
 * Ficha "explorar hotel" del asistente de Viajes: descripción + galería de fotos
 * + servicios (LiteAPI /data/hotel) y la lista de HABITACIONES con su precio real
 * (LiteAPI /hotels/rates para ese único hotel). Owner-scoped.
 *
 * El `margin` (% nuestro) va a LiteAPI para que el retail ya lo incluya, pero NO
 * se devuelve: el usuario solo ve el precio retail. La comisión nunca se expone.
 */
const Query = z.object({
  hotelId: z.string().min(1),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occupancies: z.string().optional(), // JSON [{adults,children:[]}]
});

const OccSchema = z
  .array(
    z.object({
      adults: z.coerce.number().int().min(1).max(8),
      children: z.array(z.coerce.number().int().min(0).max(17)).optional(),
    })
  )
  .min(1)
  .max(6);

const HOTEL_MARGIN_PCT = 6;

/** Forma laxa de un roomType de /hotels/rates (cubrimos variantes de la API). */
type RateRow = {
  hotelId: string;
  roomTypes?: {
    rates?: {
      name?: string;
      boardName?: string;
      boardType?: string;
      retailRate?: { total?: { amount?: number; currency?: string }[] };
    }[];
  }[];
};

export type HotelRoomOption = {
  name: string;
  board: string | null;
  priceCents: number;
  currency: string;
};

/** Aplana roomTypes→rates en opciones de habitación (ordenadas por precio, dedup). */
function roomsFromRates(row: RateRow | undefined): HotelRoomOption[] {
  const out: HotelRoomOption[] = [];
  const seen = new Set<string>();
  for (const rt of row?.roomTypes ?? []) {
    for (const r of rt.rates ?? []) {
      const amount = r.retailRate?.total?.[0]?.amount;
      if (typeof amount !== "number") continue;
      const name = (r.name ?? "Habitación").trim();
      const board = (r.boardName ?? r.boardType ?? null)?.trim() || null;
      const priceCents = Math.round(amount * 100);
      const key = `${name}|${board ?? ""}|${priceCents}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, board, priceCents, currency: r.retailRate?.total?.[0]?.currency ?? "EUR" });
    }
  }
  return out.sort((a, b) => a.priceCents - b.priceCents).slice(0, 12);
}

/** Normaliza la galería de fotos a una lista de URLs. */
function imagesOf(d: { hotelImages?: { url?: string; urlHd?: string }[]; main_photo?: string; thumbnail?: string }): string[] {
  const urls: string[] = [];
  for (const im of d.hotelImages ?? []) {
    const u = im.urlHd || im.url;
    if (u) urls.push(u);
  }
  if (urls.length === 0) {
    if (d.main_photo) urls.push(d.main_photo);
    else if (d.thumbnail) urls.push(d.thumbnail);
  }
  return [...new Set(urls)].slice(0, 12);
}

/** Normaliza servicios a strings legibles. */
function facilitiesOf(d: { hotel_facilities?: string[]; facilities?: ({ name?: string } | string)[] }): string[] {
  const out: string[] = [];
  for (const f of d.hotel_facilities ?? []) if (typeof f === "string" && f.trim()) out.push(f.trim());
  for (const f of d.facilities ?? []) {
    const name = typeof f === "string" ? f : f?.name;
    if (name && name.trim()) out.push(name.trim());
  }
  return [...new Set(out)].slice(0, 24);
}

export async function GET(req: NextRequest) {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { hotelId, checkin, checkout } = parsed.data;
  let occupancies: { adults: number; children?: number[] }[] | undefined;
  if (parsed.data.occupancies) {
    try {
      const occ = OccSchema.safeParse(JSON.parse(parsed.data.occupancies));
      if (occ.success) occupancies = occ.data;
    } catch {
      /* JSON inválido → cae a adults por defecto */
    }
  }

  try {
    // Detalle + tarifas en paralelo (independientes).
    const [details, rates] = await Promise.all([
      liteHotelDetails(hotelId).catch(() => null),
      liteHotelRates({
        hotelIds: [hotelId],
        checkin,
        checkout,
        occupancies,
        adults: 2,
        currency: "EUR",
        margin: HOTEL_MARGIN_PCT, // interno; no se devuelve
      }).catch(() => [] as unknown[]),
    ]);

    const row = (rates as RateRow[]).find((r) => r.hotelId === hotelId) ?? (rates as RateRow[])[0];
    const rooms = roomsFromRates(row);

    return NextResponse.json({
      hotel: details
        ? {
            id: details.id ?? hotelId,
            name: details.name ?? "Hotel",
            stars: details.stars ?? null,
            description: details.hotelDescription ?? null,
            address: details.address ?? null,
            city: details.city ?? null,
            country: details.country ?? null,
            lat: details.latitude ?? null,
            lng: details.longitude ?? null,
            images: imagesOf(details),
            amenities: facilitiesOf(details),
          }
        : { id: hotelId, name: "Hotel", stars: null, description: null, images: [], amenities: [] },
      rooms,
    });
  } catch (err) {
    console.error("[travel-hotel] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
