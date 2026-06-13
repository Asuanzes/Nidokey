import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { isProviderUnavailable } from "@/features/sources/providers/availability";
import { dbRestaurantsNearby, discoverGoogleRestaurants, googlePlacesConfigured } from "@/lib/food/google-restaurants";
import { prewarmMenus } from "@/lib/food/menu-scrape";

export const maxDuration = 300;

const Query = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  q: z.string().optional(),
  radiusM: z.coerce.number().int().positive().max(50000).default(6000),
});

export async function GET(req: NextRequest) {
  await requireUserId();
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parametros invalidos", detail: parsed.error.flatten() }, { status: 400 });
  }
  const { lat, lng, q, radiusM } = parsed.data;
  if (!googlePlacesConfigured()) {
    console.log("[food-google] GOOGLE_PLACES_API_KEY missing; using DB fallback");
    const restaurants = await dbRestaurantsNearby({ lat, lng, radiusM, query: q });
    return NextResponse.json({ restaurants, source: "db-fallback", googlePlaces: { configured: false } });
  }
  try {
    const restaurants = await discoverGoogleRestaurants({ lat, lng, radiusM, query: q });
    // Pre-calienta los menús de los más cercanos en background → carta instantánea al abrir.
    after(() => prewarmMenus(restaurants, 3));
    return NextResponse.json({ restaurants, source: "google" });
  } catch (e) {
    if (isProviderUnavailable(e)) {
      return NextResponse.json({ error: "Google Places no disponible", detail: e.message }, { status: 503 });
    }
    throw e;
  }
}
