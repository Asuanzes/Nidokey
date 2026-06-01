/**
 * Resolución de ubicación para empleo.
 *
 * El actor de InfoJobs (alvaraaz) valida `location` contra un ENUM de provincias
 * españolas (valores exactos abajo): si le pasas una ciudad ("Vitoria") devuelve
 * 400 y la búsqueda sale vacía. Aquí mapeamos lo que escribe el usuario
 * (ciudad o provincia, con o sin acentos) a la provincia canónica válida; si no
 * se reconoce, se omite el filtro (búsqueda nacional) en vez de fallar.
 *
 * LinkedIn (valig) acepta texto libre, pero sin país geolocaliza mal
 * ("Vitoria" → Brasil); por eso `withCountry` añade ", Spain".
 */

/** Provincias EXACTAS que acepta el actor de InfoJobs. */
const INFOJOBS_PROVINCES = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila",
  "Badajoz", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón",
  "Ceuta", "Ciudad Real", "Córdoba", "Cuenca", "Gerona", "Granada", "Guadalajara",
  "Guipúzcoa", "Huelva", "Huesca", "Islas Baleares", "Jaén", "La Rioja",
  "Las Palmas", "León", "Lérida", "Lugo", "Madrid", "Málaga", "Melilla", "Murcia",
  "Navarra", "Orense", "Palencia", "Pontevedra", "Salamanca", "Segovia", "Sevilla",
  "Soria", "Tarragona", "Tenerife", "Teruel", "Toledo", "Valencia", "Valladolid",
  "Vizcaya", "Zamora", "Zaragoza",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROVINCE_BY_NORM = new Map(INFOJOBS_PROVINCES.map((p) => [norm(p), p]));

/** Ciudades/alias frecuentes (normalizados) → provincia canónica de InfoJobs. */
const CITY_TO_PROVINCE: Record<string, string> = {
  "vitoria": "Álava", "vitoria gasteiz": "Álava", "gasteiz": "Álava",
  "bilbao": "Vizcaya", "barakaldo": "Vizcaya", "getxo": "Vizcaya", "bizkaia": "Vizcaya",
  "san sebastian": "Guipúzcoa", "donostia": "Guipúzcoa", "irun": "Guipúzcoa", "gipuzkoa": "Guipúzcoa",
  "araba": "Álava",
  "gijon": "Asturias", "oviedo": "Asturias", "aviles": "Asturias",
  "santander": "Cantabria", "torrelavega": "Cantabria",
  "logroño": "La Rioja", "logrono": "La Rioja", "rioja": "La Rioja",
  "pamplona": "Navarra", "iruña": "Navarra", "iruna": "Navarra", "nafarroa": "Navarra",
  "vigo": "Pontevedra",
  "coruña": "A Coruña", "la coruña": "A Coruña", "santiago": "A Coruña", "santiago de compostela": "A Coruña", "ferrol": "A Coruña",
  "ourense": "Orense",
  "girona": "Gerona", "lleida": "Lérida",
  "palma": "Islas Baleares", "palma de mallorca": "Islas Baleares", "mallorca": "Islas Baleares", "menorca": "Islas Baleares", "ibiza": "Islas Baleares", "baleares": "Islas Baleares", "illes balears": "Islas Baleares",
  "santa cruz de tenerife": "Tenerife", "la laguna": "Tenerife",
  "las palmas de gran canaria": "Las Palmas", "gran canaria": "Las Palmas", "telde": "Las Palmas",
  "marbella": "Málaga", "fuengirola": "Málaga", "torremolinos": "Málaga",
  "jerez": "Cádiz", "jerez de la frontera": "Cádiz", "algeciras": "Cádiz",
  "elche": "Alicante", "benidorm": "Alicante", "torrevieja": "Alicante", "alacant": "Alicante",
  "cartagena": "Murcia", "lorca": "Murcia",
  "hospitalet": "Barcelona", "l hospitalet": "Barcelona", "badalona": "Barcelona", "terrassa": "Barcelona", "sabadell": "Barcelona", "mataro": "Barcelona",
  "mostoles": "Madrid", "alcala de henares": "Madrid", "fuenlabrada": "Madrid", "leganes": "Madrid", "getafe": "Madrid", "alcorcon": "Madrid",
  "gandia": "Valencia", "torrent": "Valencia",
  "dos hermanas": "Sevilla",
  "merida": "Badajoz",
  "reus": "Tarragona",
  "castello de la plana": "Castellón",
  "castellon de la plana": "Castellón",
  "castello": "Castellón",
  "a coruna": "A Coruña",
};

/**
 * Devuelve la provincia canónica de InfoJobs para lo que escriba el usuario, o
 * `undefined` si no se reconoce (→ búsqueda nacional, sin filtro de zona).
 */
export function resolveInfoJobsProvince(input?: string): string | undefined {
  if (!input) return undefined;
  // Prueba la cadena completa y cada parte separada por comas: LinkedIn da
  // "Bilbao, Basque Country, Spain"; InfoJobs da "Vitoria-Gasteiz".
  for (const part of [input, ...input.split(",")]) {
    const n = norm(part);
    if (!n) continue;
    const hit = PROVINCE_BY_NORM.get(n) ?? CITY_TO_PROVINCE[n];
    if (hit) return hit;
  }
  return undefined;
}

/** Añade ", Spain" a una ubicación libre (LinkedIn) si no menciona país. */
export function withCountry(loc?: string): string {
  const l = (loc ?? "").trim();
  if (!l) return "";
  return /\b(spain|espa[ñn]a)\b/i.test(l) ? l : `${l}, Spain`;
}
