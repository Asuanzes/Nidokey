/**
 * Cliente fino de Travelpayouts (Aviasales Flight Data API + autocomplete de
 * lugares) para el vertical VIAJES. Patrón del repo (igual que yahoo.ts): fetch
 * plano, SIN SDK, throttle a nivel de módulo, manejo de errores explícito.
 *
 * Auth de DATOS: el API token (Perfil → API token en travelpayouts.com) va en la
 * cabecera `X-Access-Token`. Es server-side: vive en `TRAVELPAYOUTS_TOKEN`
 * (.env.local / Vercel), NUNCA en cliente. El token se genera al registrarse.
 *
 * El `marker` (ID de afiliado) NO entra aquí: solo se usa para construir enlaces
 * de afiliado (capa de monetización del bloque 2).
 *
 * NATURALEZA DE LOS DATOS: la Flight Data API devuelve precios CACHEADOS de
 * búsquedas recientes (2–7 días), no disponibilidad en vivo. Suficiente para
 * mostrar precios indicativos + un botón "reservar" (enlace afiliado).
 *
 * COBERTURA (verificado 2026-06-06 con token real):
 *  - Vuelos (Aviasales Data API): OK.
 *  - Lugares (autocomplete ciudades/hoteles): OK, host autocomplete.travelpayouts.com.
 *  - PRECIOS de hotel: PENDIENTE. El viejo Hotellook Data API (engine.hotellook.com)
 *    está DECOMISIONADO (404 en todo path) y la API de precios/búsqueda de hoteles
 *    requiere SOLICITAR acceso en el dashboard (gated). Ver hotelPrices().
 *  - Tren/bus (Renfe/ALSA) NO están: afiliación Omio/Trainline aparte.
 */

const FLIGHTS_BASE = "https://api.travelpayouts.com";
// Autocomplete de lugares (ciudades/hoteles) — host VIVO y sin token. Verificado
// 2026-06-06: engine.hotellook.com/api/v2 está decomisionado (404 en todo path).
const AUTOCOMPLETE_BASE = "https://autocomplete.travelpayouts.com";

function token(): string {
  const t = process.env.TRAVELPAYOUTS_TOKEN?.trim() || "";
  if (!t) {
    throw new Error(
      "Falta TRAVELPAYOUTS_TOKEN. Cógelo en travelpayouts.com → Perfil → API token " +
        "y ponlo en .env / Vercel."
    );
  }
  return t;
}

// ── Throttle a nivel de módulo (1 proceso): respeta la cuota (Data API ≈100/h). ──
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

// ── Hoteles ────────────────────────────────────────────────────────────────
// El antiguo Hotellook Data API (engine.hotellook.com/api/v2: lookup/cache/
// static) está DECOMISIONADO — 404 en todo path (verificado 2026-06-06). Lo único
// vivo y abierto es el AUTOCOMPLETE de lugares. Los PRECIOS de hotel requieren
// solicitar acceso a la API de hoteles en el dashboard (gated). Ver hotelPrices().

export type Place = {
  id: string;
  type: string; // "city" | "hotel" | "airport" | …
  code: string | null; // IATA ("BCN")
  name: string;
  country_code?: string | null;
  country_name?: string | null;
  coordinates?: { lon: number; lat: number } | null;
  main_airport_name?: string | null;
};

/**
 * Autocomplete de lugares: texto libre ("Barcelona") → ciudades/hoteles con su
 * id, IATA y coordenadas. Host VIVO `autocomplete.travelpayouts.com/places2`, SIN
 * token. `types`: "city" | "hotel" (varios). Base para resolver el destino del
 * asistente y para pedir precios de hotel cuando se tenga acceso a esa API.
 */
export async function hotelsLookup(
  query: string,
  types: Array<"city" | "hotel"> = ["city", "hotel"]
): Promise<Place[]> {
  const qs = new URLSearchParams({ term: query, locale: "es" });
  for (const t of types) qs.append("types[]", t);
  await throttle();
  const res = await fetch(`${AUTOCOMPLETE_BASE}/places2?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Autocomplete ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text) as Place[];
  } catch {
    throw new Error(`Autocomplete: respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

// NOTA: Travelpayouts NO ofrece datos/precios de hotel (confirmado: ninguna marca
// los provee y el viejo Hotellook está decomisionado). Los PRECIOS de hotel vienen
// de LiteAPI → src/features/sources/providers/liteapi.ts. Aquí solo queda el
// autocomplete (hotelsLookup) para resolver el destino (ciudad → IATA/coords).
