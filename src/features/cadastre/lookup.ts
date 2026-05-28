import { XMLParser } from "fast-xml-parser";
import type { CadastreInfo } from "./types";

/**
 * Cliente para los servicios públicos del Catastro Español (OVC).
 * Docs: https://www.catastro.minhap.es/ws/Webservices_Libres.pdf
 *
 * Todos los endpoints son públicos y sin clave. Devuelven XML, lo parseamos
 * con fast-xml-parser. Hay versiones "JSON" pero a menudo devuelven respuestas
 * inconsistentes, así que vamos a XML que es más fiable.
 */

// Catastro tiene DOS servicios web distintos:
//   - OVCSWLocalizacionRC → consulta por coordenadas (RCCOOR)
//   - OVCCallejero        → consulta por dirección (DNPLOC, DNPRC)
const BASE_COORDS = "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC";
const BASE_CALLEJERO = "https://ovc.catastro.meh.es/ovcservweb/OVCCallejero";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

async function fetchXml(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Nidokey/1.0 (cadastre lookup)" },
  });
  if (!res.ok) throw new Error(`Catastro ${res.status}: ${res.statusText}`);
  const text = await res.text();
  // Catastro a veces devuelve HTML de error en lugar de XML (RC inválida,
  // datos en elaboración, parcela rústica sin detalle, etc.). Lo detectamos
  // antes de parsear para dar un mensaje útil al usuario.
  const head = text.trimStart().slice(0, 100).toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) {
    throw new Error(
      "Catastro devolvió HTML (datos no disponibles, en elaboración, o RC sin información detallada)"
    );
  }
  return xmlParser.parse(text);
}

/**
 * Quita ruido de respuestas Catastro (nodos "err" con código 0 = sin error).
 * Si hay error real, lanza excepción con mensaje legible.
 */
function checkError(node: unknown, where: string): void {
  // Catastro mete los errores en consulta.lerr.err[*] con cod/des
  const root = (node as { consulta_dnp?: unknown; consulta_coordenadas?: unknown; consulta_dnploc?: unknown; consulta_dnprc?: unknown; consulta_dnplrc?: unknown; consulta_rccoor?: unknown; coord?: unknown }) || {};
  const candidates = Object.values(root);
  for (const c of candidates) {
    if (c && typeof c === "object" && c !== null && "lerr" in c) {
      const lerr = (c as { lerr?: { err?: unknown } }).lerr;
      if (lerr && lerr.err) {
        const errs = Array.isArray(lerr.err) ? lerr.err : [lerr.err];
        const meaningful = errs.find((e) => e && typeof e === "object" && (e as { cod?: number }).cod !== 0);
        if (meaningful) {
          const m = meaningful as { cod?: number; des?: string };
          throw new Error(`Catastro [${where}] cod ${m.cod}: ${m.des ?? "error desconocido"}`);
        }
      }
    }
  }
}

// ---------- 1. Por coordenadas ----------

/**
 * Dada lat/lng, devuelve la referencia catastral del inmueble.
 * Endpoint: Consulta_RCCOOR (devuelve solo PC1+PC2, los 14 primeros chars).
 */
export async function lookupByCoordinates(
  lat: number,
  lng: number
): Promise<string | null> {
  const url =
    `${BASE_COORDS}/OVCCoordenadas.asmx/Consulta_RCCOOR` +
    `?SRS=EPSG:4326&Coordenada_X=${lng}&Coordenada_Y=${lat}`;
  const data = (await fetchXml(url)) as { consulta_coordenadas?: { coordenadas?: { coord?: { pc?: { pc1?: string; pc2?: string } } } } };
  checkError(data, "Consulta_RCCOOR");
  const pc = data.consulta_coordenadas?.coordenadas?.coord?.pc;
  if (!pc?.pc1 || !pc?.pc2) return null;
  return `${pc.pc1}${pc.pc2}`;
}

// ---------- 2. Por dirección ----------

/**
 * Busca por dirección literal. La sigla suele ser "CL" (calle), "AV" (avenida),
 * "CR" (carretera), "TR" (travesía), etc. Si no la tienes, prueba "CL".
 */
export async function lookupByAddress(params: {
  province: string;
  city: string;
  street: string;
  number?: string;
  sigla?: string;
}): Promise<string | null> {
  const q = new URLSearchParams({
    Provincia: params.province.toUpperCase(),
    Municipio: params.city.toUpperCase(),
    Sigla: (params.sigla ?? "CL").toUpperCase(),
    Calle: params.street.toUpperCase(),
    Numero: params.number ?? "",
    Bloque: "",
    Escalera: "",
    Planta: "",
    Puerta: "",
  });
  const url = `${BASE_CALLEJERO}/COVCCallejero.asmx/Consulta_DNPLOC?${q.toString()}`;
  const data = (await fetchXml(url)) as {
    consulta_dnp?: {
      bico?: { idbi?: { rc?: { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string } } };
      lrcdnp?: { rcdnp?: Array<{ rc?: { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string } }> | { rc?: { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string } } };
    };
  };
  checkError(data, "Consulta_DNPLOC");

  // Caso 1: respuesta directa (un solo inmueble)
  const directRc = data.consulta_dnp?.bico?.idbi?.rc;
  if (directRc?.pc1 && directRc?.pc2) {
    return joinRC(directRc);
  }
  // Caso 2: lista de inmuebles (lrcdnp.rcdnp[])
  const list = data.consulta_dnp?.lrcdnp?.rcdnp;
  const items = Array.isArray(list) ? list : list ? [list] : [];
  if (items[0]?.rc?.pc1 && items[0]?.rc?.pc2) return joinRC(items[0].rc);

  return null;
}

function joinRC(rc: { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string }): string {
  // RC larga: PC1(7) + PC2(7) + CAR(4) + CC1(1) + CC2(1) = 20 chars
  // RC corta: PC1 + PC2 = 14 chars (parcela)
  if (rc.car && rc.cc1 && rc.cc2) return `${rc.pc1}${rc.pc2}${rc.car}${rc.cc1}${rc.cc2}`;
  return `${rc.pc1}${rc.pc2}`;
}

// ---------- 3. Datos completos por referencia catastral ----------

type DnpRcResponse = {
  consulta_dnprc?: {
    bico?: {
      bi?: {
        idbi?: { rc?: { pc1?: string; pc2?: string; car?: string; cc1?: string; cc2?: string }; cn?: string };
        dt?: {
          loine?: { cp?: string; cm?: string };
          cmc?: string;
          np?: string; // provincia
          nm?: string; // municipio
          locs?: {
            lous?: {
              lourb?: {
                dir?: {
                  cv?: string; // código vía
                  tv?: string; // tipo vía (CL, AV...)
                  nv?: string; // nombre vía
                  pnp?: string; // número
                  plp?: string;
                  snp?: string;
                };
                loint?: { es?: string; pt?: string; pu?: string }; // escalera, planta, puerta
                dp?: string; // postal code
              };
            };
          };
        };
        debi?: {
          luso?: string; // uso
          sfc?: string | number; // superficie construida m²
          ant?: string | number; // antigüedad (año)
          cpt?: string;
        };
      };
    };
    lcons?: {
      cons?:
        | Array<{
            lcd?: string;
            dt?: { lourb?: { loint?: { es?: string; pt?: string; pu?: string } } };
            dfcons?: { stl?: string | number; stt?: string | number };
          }>
        | { lcd?: string; dt?: { lourb?: { loint?: { es?: string; pt?: string; pu?: string } } }; dfcons?: { stl?: string | number; stt?: string | number } };
    };
  };
};

/**
 * Dada una referencia catastral (14 o 20 chars), devuelve los datos descriptivos.
 */
export async function fetchByRef(ref: string): Promise<CadastreInfo> {
  const q = new URLSearchParams({ Provincia: "", Municipio: "", RC: ref });
  const url = `${BASE_CALLEJERO}/COVCCallejero.asmx/Consulta_DNPRC?${q.toString()}`;
  const data = (await fetchXml(url)) as DnpRcResponse;
  checkError(data, "Consulta_DNPRC");

  const bi = data.consulta_dnprc?.bico?.bi;
  if (!bi) {
    return { ref, hasFloorplan: false, raw: data };
  }

  const rc = bi.idbi?.rc;
  const dt = bi.dt;
  const debi = bi.debi;
  const lourb = dt?.locs?.lous?.lourb;
  const dir = lourb?.dir;

  const fullRef = rc ? joinRC(rc) : ref;
  const sigla = dir?.tv?.trim();
  const street = dir?.nv?.trim();
  const number = dir?.pnp?.toString().trim();
  const addressParts: string[] = [];
  if (sigla) addressParts.push(sigla);
  if (street) addressParts.push(street);
  if (number) addressParts.push(number);

  const yearBuilt = numOrNull(debi?.ant);
  const builtArea = numOrNull(debi?.sfc);
  const floorplanUrl = `https://www1.sedecatastro.gob.es/Cartografia/GeneraGraficoParcela.aspx?refcat=${encodeURIComponent(fullRef)}&del=${rc?.pc1?.slice(0, 2)}&mun=${rc?.pc1?.slice(2, 5)}`;

  return {
    ref: fullRef,
    address: addressParts.length ? addressParts.join(" ") : undefined,
    use: typeof debi?.luso === "string" ? debi.luso : undefined,
    builtArea: builtArea ?? undefined,
    yearBuilt: yearBuilt ?? undefined,
    floor: lourb?.loint?.pt?.toString().trim() || undefined,
    hasFloorplan: true,
    floorplanUrl,
    raw: data,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// ---------- 4. Orquestador: enriquecer un Property ----------

export type EnrichInput = {
  latitude?: number | null;
  longitude?: number | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
};

export type EnrichResult = {
  ref: string | null;
  info: CadastreInfo | null;
  method: "coords" | "address" | null;
  warnings: string[];
};

/**
 * Intenta enriquecer un inmueble buscando primero por coordenadas
 * (si disponibles, es el método más fiable) y cayendo a búsqueda
 * por dirección. No lanza nunca: devuelve warnings.
 */
type Attempt = { ref: string; info: CadastreInfo | null; method: "coords" | "address" };

export async function enrichProperty(input: EnrichInput): Promise<EnrichResult> {
  const warnings: string[] = [];
  const attempts: Attempt[] = [];

  // 1. Intento por coords
  if (input.latitude != null && input.longitude != null) {
    try {
      const ref = await lookupByCoordinates(input.latitude, input.longitude);
      if (ref) {
        const info = await fetchByRef(ref).catch((e) => {
          warnings.push(`Detalle de ${ref} no disponible: ${(e as Error).message}`);
          return null;
        });
        attempts.push({ ref, info, method: "coords" });
      } else {
        warnings.push("Sin resultado por coordenadas");
      }
    } catch (e) {
      warnings.push(`Coords falló: ${(e as Error).message}`);
    }
  } else {
    warnings.push("Sin coordenadas en la ficha");
  }

  // 2. Intento por dirección (SIEMPRE intentamos también, no solo si fallaron coords:
  //    coords a veces dan una parcela rústica vacía y la dirección la urbana real).
  if (input.province && input.city && input.address) {
    const parsed = parseAddress(input.address);
    if (parsed) {
      try {
        const ref = await lookupByAddress({
          province: input.province,
          city: input.city,
          street: parsed.street,
          number: parsed.number,
          sigla: parsed.sigla,
        });
        if (ref) {
          // Si ya teníamos ref por coords y son la misma, no repetimos fetchByRef
          const sameAsCoords = attempts.find((a) => a.ref === ref);
          if (sameAsCoords) {
            attempts.push({ ref, info: sameAsCoords.info, method: "address" });
          } else {
            const info = await fetchByRef(ref).catch((e) => {
              warnings.push(`Detalle de ${ref} no disponible: ${(e as Error).message}`);
              return null;
            });
            attempts.push({ ref, info, method: "address" });
          }
        } else {
          warnings.push("Sin resultado por dirección");
        }
      } catch (e) {
        warnings.push(`Dirección falló: ${(e as Error).message}`);
      }
    } else {
      warnings.push("No se pudo parsear la dirección");
    }
  }

  if (attempts.length === 0) {
    return { ref: null, info: null, method: null, warnings };
  }

  // Score: el que tenga MÁS datos descriptivos gana. Una parcela rústica sin
  // edificación da info=null o sin builtArea/yearBuilt → score 0. Una urbana
  // con address+yearBuilt+builtArea da score alto.
  function infoScore(info: CadastreInfo | null): number {
    if (!info) return 0;
    let s = 0;
    if (info.address) s += 2;
    if (info.builtArea != null) s += 2;
    if (info.yearBuilt != null) s += 2;
    if (info.use) s += 1;
    if (info.floor) s += 1;
    return s;
  }
  attempts.sort((a, b) => infoScore(b.info) - infoScore(a.info));
  const best = attempts[0];
  if (infoScore(best.info) === 0) {
    warnings.push(
      "Catastro encontró la parcela pero no tiene datos descriptivos. Suele ocurrir en parcelas rústicas o construcciones en elaboración."
    );
  }
  return { ref: best.ref, info: best.info, method: best.method, warnings };
}

const SIGLA_MAP: Record<string, string> = {
  "calle": "CL", "c/": "CL", "c.": "CL",
  "avenida": "AV", "avda": "AV", "av.": "AV",
  "plaza": "PZ", "pl.": "PZ", "pza": "PZ",
  "paseo": "PS", "pº": "PS",
  "carretera": "CR", "ctra": "CR",
  "camino": "CM",
  "travesía": "TR", "travesia": "TR",
  "ronda": "RD",
  "glorieta": "GL",
  "barrio": "BO",
  "lugar": "LG",
};

function parseAddress(s: string): { sigla?: string; street: string; number?: string } | null {
  const norm = s.trim().replace(/,$/, "");
  if (!norm) return null;
  // Detecta sigla al inicio
  let sigla: string | undefined;
  let rest = norm;
  for (const [key, val] of Object.entries(SIGLA_MAP)) {
    const re = new RegExp(`^${key.replace(/[.]/g, "\\.")}\\s+`, "i");
    if (re.test(norm)) {
      sigla = val;
      rest = norm.replace(re, "");
      break;
    }
  }
  // Extrae número final
  const m = rest.match(/^(.+?)[,\s]+(?:n[º°]?\.?\s*)?(\d+[a-z]?)\b/i);
  if (m) {
    return { sigla: sigla ?? "CL", street: m[1].trim(), number: m[2] };
  }
  return { sigla: sigla ?? "CL", street: rest.trim() };
}
