/**
 * Cliente fino de Travelpayouts (Aviasales Flight Data API + Hotellook) para el
 * vertical VIAJES. Patrón del repo (igual que yahoo.ts): fetch plano, SIN SDK,
 * throttle a nivel de módulo, manejo de errores explícito.
 *
 * Auth de DATOS: el API token (Perfil → API token en travelpayouts.com) va en la
 * cabecera `X-Access-Token` (o como query `token`). Es server-side: vive en
 * `TRAVELPAYOUTS_TOKEN` (.env.local / Vercel), NUNCA en cliente. El token se
 * genera al registrarse y la Data API funciona SIN verificar la web.
 *
 * El `marker` (ID de afiliado) NO entra aquí: solo se usa para construir enlaces
 * de afiliado (capa de monetización del bloque 2).
 *
 * NATURALEZA DE LOS DATOS: la Data API devuelve precios CACHEADOS de búsquedas
 * recientes (2–7 días), no disponibilidad en vivo. Suficiente para mostrar
 * precios indicativos + un botón "reservar" (enlace afiliado). La búsqueda en
 * vivo de Travelpayouts exige 50K MAU → no disponible aún.
 *
 * Cobertura: vuelos (Aviasales) + hoteles (Hotellook). Tren/bus (Renfe/ALSA) NO
 * están en estas APIs (se cubren con enlaces de afiliado Omio/Trainline aparte).
 *
 * Endpoints verificados en travelpayouts.github.io/slate. Doc: support.travelpayouts.com.
 */

const FLIGHTS_BASE = "https://api.travelpayouts.com";
const HOTELLOOK_BASE = "https://engine.hotellook.com/api/v2";

function token(): string {
  const t = process.env.TRAVELPAYOUTS_TOKEN?.trim() || "";
  if (!t) {
    throw new Error(
      "Falta TRAVELPAYOUTS_TOKEN. Cógelo en travelpayouts.com → Perfil → API token " +
        "y ponlo en .env / Vercel. (El token está disponible sin verificar la web.)"
    );
  }
  return t;
}

// ── Throttle a nivel de módulo (1 proceso): respeta la cuota (Data API ≈100/h,
//    Hotellook ≈60/min). 700ms es conservador. ──
let lastCall = 0;
async function throttle(ms = 700): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

// ── Flight Data API (api.travelpayouts.com) ────────────────────────────────
// Auth por cabecera X-Access-Token. Respuesta: { success, data, ... }.

export type TpResponse<T = unknown> = {
  success?: boolean;
  data?: T;
  error?: string;
  currency?: string;
};

async function flightsGet<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<TpResponse<T>> {
  const qs = buildQuery(params);
  const url = `${FLIGHTS_BASE}${path}${qs ? `?${qs}` : ""}`;
  await throttle();
  const res = await fetch(url, {
    headers: {
      "X-Access-Token": token(),
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Travelpayouts ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as TpResponse<T>;
  } catch {
    throw new Error(`Travelpayouts ${path}: respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

export type FlightPricesOpts = {
  /** IATA origen ("MAD"). */
  origin: string;
  /** IATA destino ("BCN"). */
  destination: string;
  /** "YYYY-MM" o "YYYY-MM-DD" (opcional). */
  departDate?: string;
  /** "YYYY-MM" o "YYYY-MM-DD" (opcional → ida y vuelta). */
  returnDate?: string;
  currency?: string;
};

/**
 * GET /v1/prices/cheap — billetes más baratos por ruta (cacheado). Respuesta:
 * `data[DEST]["0"]{ price, airline, flight_number, departure_at, return_at,
 * expires_at }`. `origin`/`destination` requeridos.
 */
export function flightPricesCheap(opts: FlightPricesOpts): Promise<TpResponse> {
  return flightsGet("/v1/prices/cheap", {
    origin: opts.origin.toUpperCase(),
    destination: opts.destination.toUpperCase(),
    depart_date: opts.departDate,
    return_date: opts.returnDate,
    currency: opts.currency ?? "eur",
  });
}

/**
 * GET /v1/prices/calendar — precio mínimo por día (cacheado). Requiere
 * `depart_date` y `calendar_type` ("departure_date" | "return_date").
 */
export function flightPriceCalendar(
  opts: FlightPricesOpts & { calendarType?: "departure_date" | "return_date" }
): Promise<TpResponse> {
  return flightsGet("/v1/prices/calendar", {
    origin: opts.origin.toUpperCase(),
    destination: opts.destination.toUpperCase(),
    depart_date: opts.departDate,
    return_date: opts.returnDate,
    calendar_type: opts.calendarType ?? "departure_date",
    currency: opts.currency ?? "eur",
  });
}

// ── Hotellook (engine.hotellook.com) ───────────────────────────────────────
// Endpoints públicos estables. Auth por query `token` (API token).

async function hotellookGet<T = unknown>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const qs = buildQuery({ ...params, token: token() });
  const url = `${HOTELLOOK_BASE}${path}?${qs}`;
  await throttle();
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Hotellook ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Hotellook ${path}: respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * GET /lookup.json — resuelve un texto libre ("Barcelona") a ciudades y hoteles
 * con sus ids. `lookFor`: "city" | "hotel" | "both". Respuesta:
 * `{ results: { locations: [{ id, cityName, ... }], hotels: [{ id, label, ... }] } }`.
 */
export function hotelsLookup(query: string, lookFor: "city" | "hotel" | "both" = "both") {
  return hotellookGet<{
    results?: {
      locations?: Array<Record<string, unknown>>;
      hotels?: Array<Record<string, unknown>>;
    };
  }>("/lookup.json", { query, lang: "es", lookFor, limit: 10 });
}

export type HotelCacheOpts = {
  /** Nombre de ciudad/ubicación ("Barcelona") o "lat,lng". */
  location: string;
  /** "YYYY-MM-DD". */
  checkIn: string;
  checkOut: string;
  adults?: number;
  currency?: string;
  limit?: number;
};

/**
 * GET /cache.json — precios CACHEADOS de hoteles por ubicación. Respuesta: array
 * de `{ hotelId, hotelName, priceFrom, priceAvg, stars, location, ... }`.
 */
export function hotelPricesCache(opts: HotelCacheOpts) {
  return hotellookGet<Array<Record<string, unknown>>>("/cache.json", {
    location: opts.location,
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    adults: opts.adults ?? 2,
    currency: opts.currency ?? "eur",
    limit: opts.limit ?? 10,
  });
}
