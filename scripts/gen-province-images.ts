/**
 * Genera apps/mobile/lib/records/province-images.ts: una foto representativa de
 * la capital de cada provincia española, desde la API REST de Wikipedia (EN, que
 * lidera con foto/skyline en vez de bandera), apuntando al CDN de Wikimedia
 * (imágenes CC). Descarta banderas/escudos/mapas. Uso: npm run gen-province-images
 */
import { writeFileSync } from "node:fs";

const UA = "NidokeyJobsImages/1.0 (https://nidokey.es; personal project)";

/** Provincia canónica (enum InfoJobs) → título de su capital en en.wikipedia. */
const CAPITAL: Record<string, string> = {
  "A Coruña": "A Coruña",
  "Álava": "Vitoria-Gasteiz",
  Albacete: "Albacete",
  Alicante: "Alicante",
  Almería: "Almería",
  Asturias: "Oviedo",
  Ávila: "Ávila",
  Badajoz: "Badajoz",
  Barcelona: "Barcelona",
  Burgos: "Burgos",
  Cáceres: "Cáceres",
  Cádiz: "Cádiz",
  Cantabria: "Santander, Spain",
  Castellón: "Castelló de la Plana",
  Ceuta: "Ceuta",
  "Ciudad Real": "Ciudad Real",
  Córdoba: "Córdoba, Spain",
  Cuenca: "Cuenca, Spain",
  Gerona: "Girona",
  Granada: "Granada",
  Guadalajara: "Guadalajara, Spain",
  Guipúzcoa: "San Sebastián",
  Huelva: "Huelva",
  Huesca: "Huesca",
  "Islas Baleares": "Palma de Mallorca",
  Jaén: "Jaén, Spain",
  "La Rioja": "Logroño",
  "Las Palmas": "Las Palmas",
  León: "León, Spain",
  Lérida: "Lleida",
  Lugo: "Lugo",
  Madrid: "Madrid",
  Málaga: "Málaga",
  Melilla: "Melilla",
  Murcia: "Murcia",
  Navarra: "Pamplona",
  Orense: "Ourense",
  Palencia: "Palencia",
  Pontevedra: "Pontevedra",
  Salamanca: "Salamanca",
  Segovia: "Segovia",
  Sevilla: "Seville",
  Soria: "Soria",
  Tarragona: "Tarragona",
  Tenerife: "Santa Cruz de Tenerife",
  Teruel: "Teruel",
  Toledo: "Toledo, Spain",
  Valencia: "Valencia",
  Valladolid: "Valladolid",
  Vizcaya: "Bilbao",
  Zamora: "Zamora, Spain",
  Zaragoza: "Zaragoza",
};

/** Correcciones manuales: si alguna imagen auto sale mal, fijar aquí la URL. */
const OVERRIDES: Record<string, string> = {
  // "Cáceres" en en.wiki es desambiguación → foto de Cáceres, Spain.
  Cáceres:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Caceres_13_1_%286624238327%29.jpg/800px-Caceres_13_1_%286624238327%29.jpg",
};

const BAD = /flag|bandera|escudo|coat|locator|location_map|\.svg(\/|$)/i;

function bumpWidth(url: string, width = 800): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}

async function summaryImage(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { thumbnail?: { source?: string } };
  const thumb = j.thumbnail?.source;
  if (!thumb || BAD.test(decodeURIComponent(thumb))) return null;
  return bumpWidth(thumb, 800);
}

async function main() {
  const out: Record<string, string> = {};
  const provinces = Object.keys(CAPITAL).sort();
  for (const prov of provinces) {
    if (OVERRIDES[prov]) {
      out[prov] = OVERRIDES[prov];
      console.log(`✓ ${prov} (override)`);
      continue;
    }
    try {
      const img = await summaryImage(CAPITAL[prov]);
      if (img) {
        out[prov] = img;
        console.log(`✓ ${prov} → ${decodeURIComponent(img.split("/").pop() ?? "")}`);
      } else {
        console.warn(`✗ ${prov} (${CAPITAL[prov]}): sin foto válida`);
      }
    } catch (e) {
      console.warn(`✗ ${prov}:`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const entries = Object.keys(out)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`)
    .join("\n");
  const file = `// AUTO-GENERADO por scripts/gen-province-images.ts — no editar a mano.
// Foto representativa de la capital de cada provincia (Wikimedia / Wikipedia, CC).
// Recurso de la categoría EMPLEOS: se muestra en la ficha según meta.province.

export const PROVINCE_IMAGES: Record<string, string> = {
${entries}
};

/** URL de la foto de la capital de la provincia, o null si no la tenemos. */
export function provinceImage(province?: string | null): string | null {
  if (!province) return null;
  return PROVINCE_IMAGES[province] ?? null;
}
`;
  writeFileSync("apps/mobile/lib/records/province-images.ts", file, "utf8");
  console.log(
    `\nEscrito apps/mobile/lib/records/province-images.ts con ${Object.keys(out).length}/${provinces.length} provincias.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
