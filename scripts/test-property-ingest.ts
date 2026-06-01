/**
 * Prueba de la ingesta de inmuebles (campos + imágenes) SIN tocar la BBDD.
 *
 *   npx tsx scripts/test-property-ingest.ts
 *
 * Pasa fixtures por ImportListingInput.parse + sanitizePayload y muestra
 * ANTES (lo que mandó el cliente) vs DESPUÉS (lo que se guardaría), para
 * verificar que:
 *   - Los campos clave (hab./baños/m²/útiles/parcela/planta/año/eficiencia/
 *     amenidades) se recuperan del array `features` aunque el JSON del portal
 *     no los trajera.
 *   - Las imágenes basura (logos, marcas, mapas, svg, relativas, duplicados) se
 *     descartan y solo quedan fotos reales.
 */
import { ImportListingInput, sanitizePayload } from "../src/lib/import-listing";

type Fixture = { name: string; raw: Record<string, unknown> };

const fixtures: Fixture[] = [
  {
    name: "Fotocasa: JSON pobre, datos en `features`, imágenes sucias",
    raw: {
      url: "https://www.fotocasa.es/es/comprar/vivienda/oviedo/ejemplo-123",
      title: "Piso en venta en Oviedo centro",
      price: 185000,
      // El portal solo trajo precio/título; el resto va en features:
      rooms: null, bathrooms: null, builtArea: null, usableArea: null,
      yearBuilt: null, floor: null, energyRating: undefined,
      images: [
        "https://static.fotocasa.es/images/foto1.jpg?sig=abc",   // real (firmada)
        "https://cdn.fotocasa.es/static/img/real-a.jpg",         // /static/ → ¡REAL, debe quedar!
        "https://cdn.fotocasa.es/assets/img/real-b.jpg",         // /assets/ → ¡REAL, debe quedar!
        "https://www.fotocasa.es/img/logo-fotocasa.svg",         // logo svg → fuera
        "https://maps.googleapis.com/maps/staticmap?center=x",   // mapa → fuera
        "https://static.fotocasa.es/images/foto1.jpg?sig=zzz",   // dup (mismo path) → fuera
        "https://static.fotocasa.es/images/foto2.jpg",           // real
        "/relativa/foto3.jpg",                                   // no http → fuera
        "https://cdn.fotocasa.es/img/watermark.png",             // marca → fuera
        "https://static.fotocasa.es/images/foto4.webp",          // real
      ],
      features: [
        "3 habitaciones", "2 baños", "90 m² construidos", "75 m² útiles",
        "4ª Planta", "Construido en 1998", "Ascensor", "Sin garaje",
        "Terraza de 12 m²", "Trastero", "Certificación energética: D",
        "4.153 €/m²",
      ],
    },
  },
  {
    name: "Chalet: parcela + piscina + jardín; sin baños en el texto",
    raw: {
      url: "https://www.idealista.com/inmueble/99887766/",
      title: "Chalet independiente con parcela",
      price: 420000,
      type: "CHALET",
      images: [
        "https://img4.idealista.com/blur/WEB_DETAIL/0/id.master/foto-a.jpg",
        "https://st.idealista.com/static/common/logo-idealista.png", // logo → fuera
        "https://img4.idealista.com/blur/WEB_DETAIL/0/id.master/foto-b.jpg",
      ],
      features: [
        "Parcela de 1.200 m²", "180 m² construidos", "4 habitaciones",
        "Piscina", "Jardín", "Garaje", "Calefacción central",
        "Consumo energético 95 kWh/m² año  E",
      ],
    },
  },
];

const FIELDS = [
  "rooms", "bathrooms", "builtArea", "usableArea", "plotArea", "floor",
  "yearBuilt", "energyRating", "hasElevator", "hasGarage", "hasStorage",
  "hasTerrace", "hasFireplace", "hasGarden", "hasPool",
] as const;

function show(label: string, obj: Record<string, unknown>) {
  const parts = FIELDS.map((f) => `${f}=${JSON.stringify(obj[f] ?? null)}`);
  console.log(`  ${label}:`);
  console.log("    " + parts.join("  "));
}

for (const fx of fixtures) {
  console.log("\n" + "─".repeat(78));
  console.log("● " + fx.name);

  const parsed = ImportListingInput.safeParse(fx.raw);
  if (!parsed.success) {
    console.log("  ❌ ImportListingInput rechazó el payload:", parsed.error.issues[0]?.message);
    continue;
  }
  const before = parsed.data;
  const after = sanitizePayload(before);

  show("ANTES (cliente)", before as unknown as Record<string, unknown>);
  show("DESPUÉS (a guardar)", after as unknown as Record<string, unknown>);

  console.log(`  IMÁGENES: ${fx.raw.images && (fx.raw.images as unknown[]).length} recibidas → ${after.images.length} válidas`);
  after.images.forEach((u, i) => console.log(`    [${i}] ${u}`));
}
console.log("\n" + "─".repeat(78));
