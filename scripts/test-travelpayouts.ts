/**
 * Prueba MANUAL del provider Travelpayouts (vertical VIAJES). NO escribe en BBDD.
 *
 * Verifica el provider de DATOS:
 *   1) Vuelos más baratos (Aviasales Data API, cacheado): MAD → BCN.
 *   2) Hoteles (Hotellook): lookup de "Barcelona" + precios cacheados.
 *
 * Uso:
 *   1) Pon TRAVELPAYOUTS_TOKEN en .env (o .env.local). Lo consigues YA en
 *      travelpayouts.com → Perfil → API token (sin verificar la web).
 *   2) npm run test-travelpayouts
 *
 * Solo DATOS: no construye enlaces de afiliado (eso es el bloque 2). Recuerda que
 * la Data API devuelve precios CACHEADOS (2–7 días), no disponibilidad en vivo;
 * algunas rutas/fechas pueden venir con pocos o cero resultados sin ser un error.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  flightPricesCheap,
  hotelsLookup,
  hotelPrices,
} from "../src/features/sources/providers/travelpayouts";

// tsx no carga .env por sí solo → cargador mínimo (sin dependencias).
function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

/** "YYYY-MM-DD" a `days` días vista. */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.TRAVELPAYOUTS_TOKEN) {
    console.error(
      "⚠️  Falta TRAVELPAYOUTS_TOKEN. Defínelo en .env (o .env.local) y reintenta.\n" +
        "    Lo consigues en travelpayouts.com → Perfil → API token (disponible al\n" +
        "    registrarte, sin verificar la web)."
    );
    process.exitCode = 1;
    return;
  }

  // 1) Vuelos baratos MAD → BCN (mes que viene)
  const departDate = inDays(21).slice(0, 7); // YYYY-MM
  console.log(`Vuelos baratos MAD → BCN (${departDate})…`);
  const flights = await flightPricesCheap({
    origin: "MAD",
    destination: "BCN",
    departDate,
    currency: "eur",
  });
  const byDest = (flights.data ?? {}) as Record<string, Record<string, { price?: number; airline?: string; departure_at?: string }>>;
  const offers = Object.values(byDest.BCN ?? {});
  console.log(`✓ success=${flights.success} · ${offers.length} ofertas en caché`);
  const f0 = offers[0];
  if (f0) console.log(`   ej.: ${f0.price} EUR · ${f0.airline} · sale ${f0.departure_at}`);
  console.log();

  // 2) Lugares (autocomplete) — ciudades/hoteles de "Barcelona"
  console.log("Autocomplete: lugares de 'Barcelona'…");
  const places = await hotelsLookup("Barcelona", ["city", "hotel"]);
  const cities = places.filter((p) => p.type === "city");
  const hotels = places.filter((p) => p.type === "hotel");
  console.log(`✓ ${places.length} lugares (${cities.length} ciudades · ${hotels.length} hoteles)`);
  const c0 = cities[0];
  if (c0) console.log(`   ej.: ${c0.name} (${c0.code}) · ${c0.country_name} · ${c0.coordinates?.lat},${c0.coordinates?.lon}`);
  console.log();

  // 3) Precios de hotel — PENDIENTE de acceso (no rompe el test)
  console.log("Precios de hotel…");
  try {
    await hotelPrices({ location: "Barcelona", checkIn: inDays(21), checkOut: inDays(24), limit: 5 });
  } catch (e) {
    console.log(`⏳ ${e instanceof Error ? e.message : e}`);
  }

  console.log("\n✓ Provider Travelpayouts: vuelos + autocomplete OK. Precios de hotel pendientes de acceso.");
}

main().catch((e) => {
  console.error("\n✗ Error Travelpayouts:", e instanceof Error ? e.message : e);
  console.error(
    "   Pistas: 401 = token inválido; datos en caché pueden venir vacíos para\n" +
      "   rutas/fechas poco buscadas (no es un fallo). Si Hotellook pide 'marker'\n" +
      "   en vez de 'token', avísame y lo ajusto."
  );
  process.exitCode = 1;
});
