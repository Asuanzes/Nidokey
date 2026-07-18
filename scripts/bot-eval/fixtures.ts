import type { ToolRunner } from "../../src/lib/chat/agent";
import type { EvalCase, Fixture } from "./types";

/**
 * Mundo de fixtures por defecto: la usuaria ficticia "Eva" y sus registros.
 * MISMA forma que produce el runTool real (compactRecords: id/type/title/
 * subtitle/value/status; JSON en string). Las tools de ESCRITURA devuelven un
 * ok sintético y JAMÁS tocan red o BBDD. Overrides por caso vía c.fixtures.
 */

const j = (v: unknown) => JSON.stringify(v);

// Ids estables con pinta de cuid — los asserts comprueban que el bot solo
// enlaza ids que aparecieron en resultados de tools (anti-alucinación).
export const IDS = {
  uria: "cmev0prop0uria",
  uriaDup: "cmev0prop0uriab",
  gijon: "cmev0prop0gijon",
  btc: "cmev0cry0btc",
  eth: "cmev0cry0eth",
  aapl: "cmev0mkt0aapl",
  sp500: "cmev0mkt0sp500",
  reyes: "cmev0book0reyes",
  palabras: "cmev0book0palab",
  sapiens: "cmev0book0sapiens",
  dune: "cmev0book0dune",
  novela1984: "cmev0book01984",
  roma: "cmev0hol0roma",
  sushi: "cmev0rest0sushi",
  alma: "cmev0rest0alma",
  sharedPiso: "cmev0shar0piso",
} as const;

const WORLD: Record<string, unknown[]> = {
  property: [
    { id: IDS.uria, type: "property", title: "Piso en Calle Uría 12, Oviedo", subtitle: "3 hab · 90 m²", value: "185.000 €", status: "FOR_SALE" },
    { id: IDS.uriaDup, type: "property", title: "Piso Calle Uría 12 (Fotocasa)", subtitle: "3 hab · 89 m²", value: "186.000 €", status: "FOR_SALE" },
    { id: IDS.gijon, type: "property", title: "Ático en Gijón Centro", subtitle: "2 hab · 70 m²", value: "650 €/mes", status: "FOR_RENT" },
  ],
  crypto: [
    { id: IDS.btc, type: "crypto", title: "Bitcoin", subtitle: "BTC", value: "61.234 €", status: null },
    { id: IDS.eth, type: "crypto", title: "Ethereum", subtitle: "ETH", value: "2.987 €", status: null },
  ],
  market: [
    { id: IDS.aapl, type: "market", title: "Apple Inc.", subtitle: "AAPL", value: "212,10 €", status: null },
    { id: IDS.sp500, type: "market", title: "Vanguard S&P 500 ETF", subtitle: "VUSA", value: "89,40 €", status: null },
  ],
  book: [
    { id: IDS.reyes, type: "book", title: "El camino de los reyes", subtitle: "Brandon Sanderson", value: null, status: null },
    { id: IDS.palabras, type: "book", title: "Palabras radiantes", subtitle: "Brandon Sanderson", value: null, status: null },
    { id: IDS.sapiens, type: "book", title: "Sapiens", subtitle: "Yuval Noah Harari", value: null, status: null },
    { id: IDS.dune, type: "book", title: "Dune", subtitle: "Frank Herbert", value: null, status: null },
    { id: IDS.novela1984, type: "book", title: "1984", subtitle: "George Orwell", value: null, status: null },
  ],
  job: [], // por defecto Eva no tiene empleos guardados (caso honestidad)
  holiday: [
    { id: IDS.roma, type: "holiday", title: "Roma, octubre 2026", subtitle: "3 noches · 2 personas", value: "420 €", status: "PLANNED" },
  ],
};

const DETAILS: Record<string, unknown> = {
  [IDS.uria]: {
    id: IDS.uria, type: "property", title: "Piso en Calle Uría 12, Oviedo", price: "185.000 €",
    pricePerM2: "2.055 €/m²", rooms: 3, size: "90 m²", operation: "SALE", status: "FOR_SALE",
    history: [{ at: "2026-05-01", price: "189.000 €" }, { at: "2026-06-20", price: "185.000 €" }],
  },
  [IDS.btc]: { id: IDS.btc, type: "crypto", title: "Bitcoin", symbol: "BTC", price: "61.234 €", change24h: "-1,2%", marketCap: "1,2 B€" },
  [IDS.eth]: { id: IDS.eth, type: "crypto", title: "Ethereum", symbol: "ETH", price: "2.987 €", change24h: "+0,8%", marketCap: "359 M€" },
  [IDS.sapiens]: {
    id: IDS.sapiens, type: "book", title: "Sapiens", author: "Yuval Noah Harari",
    sinopsis: "Recorrido por la historia de la humanidad: de las revoluciones cognitiva y agrícola a la científica, y cómo los mitos compartidos articulan sociedades.",
    rating: 4.4, notes: null,
  },
};

const TRENDS = [
  { id: "cmev0tr0furia", name: "#FuriaAsturiana", source: "twitter", volume: 12800 },
  { id: "cmev0tr0eclip", name: "Eclipse solar", source: "googletrends", volume: 50000 },
  { id: "cmev0tr0rust", name: "Rust 2.0", source: "hackernews", volume: 812 },
];

const NEWS = [
  { title: "Bitcoin se estabiliza tras la corrección", source: "CoinDesk", url: "https://example.com/btc1", at: "2026-07-17" },
  { title: "Los ETF de S&P 500 marcan máximos", source: "Reuters", url: "https://example.com/sp1", at: "2026-07-16" },
];

const RESTAURANTS = [
  { id: IDS.sushi, nombre: "Sushi Nido", direccion: "C/ Rosal 4, Oviedo" },
  { id: IDS.alma, nombre: "Pizzería Alma", direccion: "C/ Gascona 11, Oviedo" },
];

// Cartas por restaurante — la default DEBE ser coherente con el restaurant_id
// pedido (una carta de sushi para la pizzería hizo dudar al modelo, con razón).
const MENUS: Record<string, unknown> = {
  [IDS.sushi]: {
    restaurante: "Sushi Nido",
    menuStatus: "READY",
    platos: [
      { plato: "Nigiri salmón (2u)", precio_eur: 4.5, categoria: "Nigiri" },
      { plato: "Ramen tonkotsu", precio_eur: 11.9, categoria: "Calientes" },
    ],
  },
  [IDS.alma]: {
    restaurante: "Pizzería Alma",
    menuStatus: "READY",
    platos: [
      { plato: "Pizza margarita", precio_eur: 9.5, categoria: "Pizzas" },
      { plato: "Pizza cuatro quesos", precio_eur: 12, categoria: "Pizzas" },
    ],
  },
};

/** Respuesta del mundo por defecto para una tool (paridad con runTool real). */
function defaultWorld(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "listar_registros": {
      const type = String(args.type ?? "");
      if (!(type in WORLD)) return j({ error: "categoría no válida" });
      return j(WORLD[type]);
    }
    case "ver_registro": {
      const id = String(args.id ?? "");
      const detail = DETAILS[id] ?? Object.values(WORLD).flat().find((r) => (r as { id: string }).id === id);
      return detail ? j(detail) : j({ error: "no encontrado" });
    }
    case "tendencias": {
      const source = args.source ? String(args.source) : "all";
      return j(source === "all" ? TRENDS : TRENDS.filter((t) => t.source === source));
    }
    case "noticias_tendencia":
      return j([{ title: "La tendencia del día, explicada", source: "ElPais", url: "https://example.com/t1" }]);
    case "noticias_activos":
      return j(NEWS);
    case "buscar_restaurantes":
      return j(RESTAURANTS);
    case "buscar_platos":
      return j([{ plato: "Ramen tonkotsu", precio_eur: 11.9, restaurante: "Sushi Nido", restaurant_id: IDS.sushi }]);
    case "carta_restaurante": {
      const id = String(args.restaurant_id ?? "");
      return j(MENUS[id] ?? { error: "restaurante no encontrado" });
    }
    case "compartidos_conmigo":
      return j([]); // por defecto nadie le ha compartido nada
    // ── ESCRITURAS: ok sintético; nunca red/BBDD. El eval vigila CUÁNDO se llaman.
    case "crear_registro":
      return j({ ok: true, created: { id: "cmev0new00001", type: args.type ?? null } });
    case "borrar_registro":
    case "fusionar_registros":
    case "compartir_registro":
    case "guardar_compartido":
    case "editar_registro":
      return j({ ok: true });
    default:
      return j({ error: "herramienta desconocida" });
  }
}

/** ToolRunner inyectable para runAgent: overrides del caso → mundo por defecto. */
export function makeToolRunner(c: EvalCase): ToolRunner {
  return async (name, argsJson) => {
    let args: Record<string, unknown> = {};
    try {
      args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
      /* args inválidos → {} */
    }
    const fx: Fixture | undefined = c.fixtures?.[name ?? ""];
    if (fx !== undefined) return typeof fx === "function" ? fx(args) : fx;
    return defaultWorld(name ?? "", args);
  };
}
