/**
 * DIRECTORIO DE PORTALES INMOBILIARIOS — datos de REFERENCIA (no runtime).
 *
 * Sirve para clasificar portales por región/idioma/cobertura de cara a la
 * geolocalización y la planificación de qué integrar. NO está acoplado al enum
 * `Portal` (que sigue con los portales españoles ya cableados en import/scraping):
 * esto es un catálogo aparte, ampliable, para decidir prioridades.
 *
 * ⚠️ `hasApi`, `scrape`, `coverage` y `priority` son BEST-EFFORT (estado general
 * conocido, no verificado contra cada portal hoy). Revisar antes de integrar uno.
 *
 * Cómo usarlo: `import { PORTAL_DIRECTORY, portalsByRegion } from "@nidokey/shared"`.
 */

export type PortalRegion = "europe" | "asia" | "americas" | "oceania";

/** Dificultad de obtención de datos por scraping/extractor cliente.
 *  - "easy":    el extractor (WebView/JSON-LD) saca los datos sin fricción.
 *  - "hard":    estructura compleja / lazy / sin JSON-LD → requiere trabajo.
 *  - "blocked": anti-bot fuerte (DataDome/PerimeterX…) bloquea la lectura. */
export type ScrapeDifficulty = "easy" | "hard" | "blocked";

export type PortalMeta = {
  /** Identificador estable en kebab/snake (no es el enum `Portal`). */
  key: string;
  name: string;
  /** Dominios principales (para detección de host). */
  domains: string[];
  /** País(es) principal(es), nombre legible. */
  country: string;
  region: PortalRegion;
  /** Idioma principal del portal (ISO 639-1). */
  language: string;
  /** Cobertura geográfica (texto libre). */
  coverage: string;
  /** ¿Existe API pública (aunque requiera alta/clave)? */
  hasApi: boolean;
  scrape: ScrapeDifficulty;
  /** Prioridad de integración por volumen + calidad de geolocalización (1 alta … 3 baja). */
  priority: 1 | 2 | 3;
  /** ¿Ya está cableado el import en la app (extractor cliente)? */
  integrated?: boolean;
  notes?: string;
};

export const PORTAL_DIRECTORY: PortalMeta[] = [
  // ── Europa — España (ya integrados vía extractor cliente) ──────────────────
  { key: "idealista", name: "Idealista", domains: ["idealista.com", "idealista.it", "idealista.pt"], country: "España/Portugal/Italia", region: "europe", language: "es", coverage: "España, Portugal, Italia", hasApi: true, scrape: "blocked", priority: 1, integrated: true, notes: "API con alta de desarrollador; web con DataDome (manual/userscript)." },
  { key: "fotocasa", name: "Fotocasa", domains: ["fotocasa.es"], country: "España", region: "europe", language: "es", coverage: "España (nacional)", hasApi: false, scrape: "easy", priority: 1, integrated: true },
  { key: "pisos-com", name: "Pisos.com", domains: ["pisos.com"], country: "España", region: "europe", language: "es", coverage: "España (nacional)", hasApi: false, scrape: "easy", priority: 2, integrated: true },
  { key: "habitaclia", name: "Habitaclia", domains: ["habitaclia.com"], country: "España", region: "europe", language: "es", coverage: "España (fuerte en Cataluña/Levante)", hasApi: false, scrape: "easy", priority: 2, integrated: true },
  { key: "thinkspain", name: "ThinkSpain", domains: ["thinkspain.com"], country: "España", region: "europe", language: "en", coverage: "España (expatriados)", hasApi: false, scrape: "easy", priority: 3, integrated: true },
  { key: "indomio", name: "Indomio", domains: ["indomio.es"], country: "España", region: "europe", language: "es", coverage: "España", hasApi: false, scrape: "easy", priority: 3, integrated: true },
  { key: "milanuncios", name: "Milanuncios", domains: ["milanuncios.com"], country: "España", region: "europe", language: "es", coverage: "España (clasificados)", hasApi: false, scrape: "blocked", priority: 2, integrated: true, notes: "DataDome → manual/userscript." },
  { key: "yaencontre", name: "Yaencontre", domains: ["yaencontre.com"], country: "España", region: "europe", language: "es", coverage: "España", hasApi: false, scrape: "blocked", priority: 3, integrated: true, notes: "Anti-bot." },

  // ── Europa — resto ─────────────────────────────────────────────────────────
  { key: "rightmove", name: "Rightmove", domains: ["rightmove.co.uk"], country: "Reino Unido", region: "europe", language: "en", coverage: "Reino Unido (líder)", hasApi: false, scrape: "hard", priority: 1 },
  { key: "zoopla", name: "Zoopla", domains: ["zoopla.co.uk"], country: "Reino Unido", region: "europe", language: "en", coverage: "Reino Unido", hasApi: true, scrape: "hard", priority: 2, notes: "API histórica con acceso limitado." },
  { key: "seloger", name: "SeLoger", domains: ["seloger.com"], country: "Francia", region: "europe", language: "fr", coverage: "Francia (líder)", hasApi: false, scrape: "hard", priority: 1 },
  { key: "immobilienscout24", name: "ImmobilienScout24", domains: ["immobilienscout24.de"], country: "Alemania/Austria", region: "europe", language: "de", coverage: "Alemania, Austria (líder)", hasApi: true, scrape: "hard", priority: 1, notes: "API IS24 con alta." },

  // ── Asia ───────────────────────────────────────────────────────────────────
  { key: "propertyguru", name: "PropertyGuru", domains: ["propertyguru.com.sg", "propertyguru.com.my"], country: "Sudeste asiático", region: "asia", language: "en", coverage: "Singapur, Malasia, Tailandia, Indonesia, Vietnam", hasApi: false, scrape: "hard", priority: 1 },
  { key: "99co", name: "99.co", domains: ["99.co"], country: "Singapur/Indonesia", region: "asia", language: "en", coverage: "Singapur, Indonesia", hasApi: false, scrape: "hard", priority: 2 },
  { key: "housing-com", name: "Housing.com", domains: ["housing.com"], country: "India", region: "asia", language: "en", coverage: "India", hasApi: false, scrape: "hard", priority: 1 },
  { key: "makaan", name: "Makaan", domains: ["makaan.com"], country: "India", region: "asia", language: "en", coverage: "India", hasApi: false, scrape: "hard", priority: 2 },
  { key: "square-yards", name: "Square Yards", domains: ["squareyards.com"], country: "India/EAU/Canadá", region: "asia", language: "en", coverage: "India, EAU, Canadá", hasApi: false, scrape: "hard", priority: 2 },

  // ── América ──────────────────────────────────────────────────────────────────
  { key: "zillow", name: "Zillow", domains: ["zillow.com"], country: "Estados Unidos", region: "americas", language: "en", coverage: "EE. UU. (líder)", hasApi: true, scrape: "blocked", priority: 1, notes: "API Bridge/Zillow con alta; web con anti-bot fuerte." },
  { key: "realtor-com", name: "Realtor.com", domains: ["realtor.com"], country: "Estados Unidos", region: "americas", language: "en", coverage: "EE. UU.", hasApi: false, scrape: "hard", priority: 1 },
  { key: "trulia", name: "Trulia", domains: ["trulia.com"], country: "Estados Unidos", region: "americas", language: "en", coverage: "EE. UU. (grupo Zillow)", hasApi: false, scrape: "hard", priority: 2 },
  { key: "homes-com", name: "Homes.com", domains: ["homes.com"], country: "Estados Unidos", region: "americas", language: "en", coverage: "EE. UU.", hasApi: false, scrape: "hard", priority: 2 },
  { key: "mercadolibre-inmuebles", name: "Mercado Libre Inmuebles", domains: ["mercadolibre.com.ar", "mercadolibre.com.mx", "inmuebles.mercadolibre.com.ar"], country: "Latinoamérica", region: "americas", language: "es", coverage: "Argentina, México, y resto de LatAm", hasApi: true, scrape: "easy", priority: 1, notes: "API pública de Mercado Libre." },
  { key: "properati", name: "Properati", domains: ["properati.com.ar", "properati.com.mx", "properati.com.co"], country: "Latinoamérica", region: "americas", language: "es", coverage: "Argentina, México, Colombia, Ecuador, Perú", hasApi: false, scrape: "hard", priority: 2 },

  // ── Oceanía ──────────────────────────────────────────────────────────────────
  { key: "realestate-com-au", name: "realestate.com.au", domains: ["realestate.com.au"], country: "Australia", region: "oceania", language: "en", coverage: "Australia (líder)", hasApi: false, scrape: "hard", priority: 1 },
  { key: "domain-com-au", name: "Domain", domains: ["domain.com.au"], country: "Australia", region: "oceania", language: "en", coverage: "Australia", hasApi: true, scrape: "hard", priority: 1, notes: "API Domain con alta." },
  { key: "homes-co-nz", name: "homes.co.nz", domains: ["homes.co.nz"], country: "Nueva Zelanda", region: "oceania", language: "en", coverage: "Nueva Zelanda", hasApi: false, scrape: "hard", priority: 2 },
  { key: "trademe-property", name: "Trade Me Property", domains: ["trademe.co.nz"], country: "Nueva Zelanda", region: "oceania", language: "en", coverage: "Nueva Zelanda (líder)", hasApi: true, scrape: "easy", priority: 1, notes: "API pública de Trade Me." },
  { key: "homely", name: "Homely", domains: ["homely.com.au"], country: "Australia", region: "oceania", language: "en", coverage: "Australia", hasApi: false, scrape: "hard", priority: 3 },
];

/** Mapa dominio → portal (para detección rápida; usa el primer match por `includes`). */
export function portalMetaForUrl(url: string): PortalMeta | null {
  const u = url.toLowerCase();
  for (const p of PORTAL_DIRECTORY) {
    if (p.domains.some((d) => u.includes(d))) return p;
  }
  return null;
}

/** Portales agrupados por región, ordenados por prioridad (1 primero). */
export function portalsByRegion(region: PortalRegion): PortalMeta[] {
  return PORTAL_DIRECTORY.filter((p) => p.region === region).sort((a, b) => a.priority - b.priority);
}
