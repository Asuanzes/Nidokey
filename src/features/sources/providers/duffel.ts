/**
 * Cliente fino de Duffel (https://duffel.com) para PRECIOS DE VUELO en vivo del
 * vertical VIAJES. A diferencia de la Data API cacheada de Travelpayouts, Duffel
 * busca en tiempo real CUALQUIER ruta/fecha con aerolíneas reales.
 *
 * Uso en el producto: Duffel da el PRECIO (mostrado en la app, fechas exactas);
 * la RESERVA/monetización sigue por enlace afiliado de Aviasales (marker
 * Travelpayouts) — NO usamos el flujo de reserva+pago de Duffel (eso te convierte
 * en comercio: pesado). Así: precio real de cualquier ruta + comisión sin pagos.
 *
 * Patrón del repo (fetch plano, sin SDK, throttle). Auth: `Authorization: Bearer
 * DUFFEL_TOKEN` (server-side) + cabecera `Duffel-Version`. Token de test empieza
 * por `duffel_test_`.
 */

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

function duffelToken(): string {
  const t = process.env.DUFFEL_TOKEN?.trim() || "";
  if (!t) {
    throw new Error(
      "Falta DUFFEL_TOKEN. Créalo en app.duffel.com → (organización) → Developers " +
        "→ Access tokens (modo test) y ponlo en .env / Vercel."
    );
  }
  return t;
}

let lastCall = 0;
async function throttle(ms = 300): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export type DuffelSegment = {
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { name?: string; iata_code?: string };
  marketing_carrier_flight_number?: string;
};
export type DuffelOffer = {
  id: string;
  total_amount: string; // "144.91"
  total_currency: string; // "EUR"
  owner?: { name?: string; iata_code?: string };
  slices?: Array<{ segments?: DuffelSegment[] }>;
};

/**
 * POST /air/offer_requests?return_offers=true — búsqueda EN VIVO. `slices` =
 * trayectos (ida + vuelta si hay returnDate). Devuelve las ofertas inline.
 */
export async function duffelSearchOffers(opts: {
  origin: string;
  destination: string;
  departDate: string; // "YYYY-MM-DD"
  returnDate?: string;
  adults?: number;
  cabin?: "economy" | "premium_economy" | "business" | "first";
}): Promise<DuffelOffer[]> {
  const o = opts.origin.toUpperCase();
  const d = opts.destination.toUpperCase();
  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin: o, destination: d, departure_date: opts.departDate },
  ];
  if (opts.returnDate) slices.push({ origin: d, destination: o, departure_date: opts.returnDate });
  const passengers = Array.from({ length: Math.max(1, opts.adults ?? 1) }, () => ({ type: "adult" }));

  await throttle();
  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true&supplier_timeout=12000`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${duffelToken()}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ data: { slices, passengers, cabin_class: opts.cabin ?? "economy" } }),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Duffel ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    const json = JSON.parse(text) as { data?: { offers?: DuffelOffer[] } };
    return json.data?.offers ?? [];
  } catch {
    throw new Error(`Duffel: respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

/** Oferta más barata (por total_amount). */
export function cheapestOffer(offers: DuffelOffer[]): DuffelOffer | null {
  let best: DuffelOffer | null = null;
  let bestVal = Infinity;
  for (const o of offers) {
    const v = parseFloat(o.total_amount);
    if (Number.isFinite(v) && v < bestVal) {
      best = o;
      bestVal = v;
    }
  }
  return best;
}
