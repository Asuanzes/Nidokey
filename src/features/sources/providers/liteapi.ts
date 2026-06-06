/**
 * Cliente fino de LiteAPI (https://liteapi.travel) para PRECIOS DE HOTEL del
 * vertical VIAJES. Travelpayouts NO ofrece datos de hotel (confirmado), así que
 * los hoteles vienen de aquí: LiteAPI da búsqueda + tarifas reales + reserva, con
 * alta self-serve instantánea (sandbox key gratis) y monetización por MARGEN
 * (parámetro `margin` = % que ganas en cada reserva).
 *
 * Patrón del repo (yahoo.ts): fetch plano, sin SDK, throttle a nivel de módulo.
 * Auth: cabecera `X-API-Key` (server-side; `LITEAPI_KEY` en .env / Vercel).
 * Base: https://api.liteapi.travel/v3.0
 *
 * Flujo (cookbook oficial): GET /data/hotels?countryCode&cityName → ids de hotel;
 * POST /hotels/rates con esos ids + fechas + ocupación → tarifas reales.
 * Sandbox: tarjeta de prueba 4242 4242 4242 4242 (para el flujo de reserva, bloque 2).
 */

const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";

function liteKey(): string {
  const k = process.env.LITEAPI_KEY?.trim() || "";
  if (!k) {
    throw new Error(
      "Falta LITEAPI_KEY. Regístrate en liteapi.travel → Perfil → Sandbox key " +
        "y ponla en .env / Vercel (server-side)."
    );
  }
  return k;
}

// ── Throttle a nivel de módulo. ──
let lastCall = 0;
async function throttle(ms = 400): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function liteFetch<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST"; query?: Record<string, string | number | undefined>; body?: unknown } = {}
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${LITEAPI_BASE}${path}${qs.toString() ? `?${qs}` : ""}`;
  await throttle();
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "X-API-Key": liteKey(),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LiteAPI ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`LiteAPI ${path}: respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

// ── Búsqueda de hoteles por ciudad ─────────────────────────────────────────
export type LiteHotel = {
  id: string; // hotelId
  name?: string;
  hotelDescription?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  stars?: number;
  main_photo?: string;
  thumbnail?: string;
};

/**
 * GET /data/hotels — lista de hoteles por país+ciudad. `countryCode` ISO-2
 * ("ES"), `cityName` ("Barcelona"). Devuelve `{ data: LiteHotel[] }`. La lista
 * puede ser grande → se usa `limit` y luego se piden tarifas de los primeros N.
 */
export async function liteHotelsByCity(opts: {
  countryCode: string;
  cityName: string;
  limit?: number;
}): Promise<LiteHotel[]> {
  const json = await liteFetch<{ data?: LiteHotel[] }>("/data/hotels", {
    query: {
      countryCode: opts.countryCode.toUpperCase(),
      cityName: opts.cityName,
      limit: opts.limit ?? 30,
    },
  });
  return json.data ?? [];
}

/**
 * Hoteles por COORDENADAS (lat/lng + radio en metros). Más robusto que cityName:
 * `cityName` exige el nombre en INGLÉS ("London", no "Londres") y falla con
 * nombres localizados; las coordenadas del autocomplete no dependen del idioma.
 */
export async function liteHotelsByCoords(opts: {
  lat: number;
  lng: number;
  radius?: number; // metros
  limit?: number;
}): Promise<LiteHotel[]> {
  const json = await liteFetch<{ data?: LiteHotel[] }>("/data/hotels", {
    query: {
      latitude: opts.lat,
      longitude: opts.lng,
      radius: opts.radius ?? 20000,
      limit: opts.limit ?? 30,
    },
  });
  return json.data ?? [];
}

// ── Tarifas reales por hotel ───────────────────────────────────────────────
export type LiteRatesOpts = {
  hotelIds: string[];
  /** "YYYY-MM-DD". */
  checkin: string;
  checkout: string;
  adults?: number;
  /** ISO-2 nacionalidad del huésped (afecta tarifas). */
  guestNationality?: string;
  currency?: string;
  /** % de margen que ganas en la reserva (monetización). */
  margin?: number;
};

/**
 * POST /hotels/rates — tarifas reales con disponibilidad para una lista de
 * hoteles. Body: `{ hotelIds, occupancies:[{adults}], checkin, checkout,
 * currency, guestNationality, margin }`. Respuesta: `{ data: [{ hotelId,
 * roomTypes:[{ rates:[{ retailRate... }] }] }] }` (la forma exacta del precio se
 * confirma con el primer resultado real).
 */
export async function liteHotelRates(opts: LiteRatesOpts): Promise<unknown[]> {
  const json = await liteFetch<{ data?: unknown[] }>("/hotels/rates", {
    method: "POST",
    body: {
      hotelIds: opts.hotelIds,
      occupancies: [{ adults: opts.adults ?? 2 }],
      checkin: opts.checkin,
      checkout: opts.checkout,
      currency: opts.currency ?? "EUR",
      guestNationality: opts.guestNationality ?? "ES",
      ...(opts.margin != null ? { margin: opts.margin } : {}),
    },
  });
  return json.data ?? [];
}
