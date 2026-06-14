import { hasApifyToken, runActorGetItems, type ApifyItem } from "./apify";

/**
 * Menús de PLATAFORMAS DE DELIVERY (Glovo / Just Eat) vía actores de Apify, que
 * devuelven la carta YA ESTRUCTURADA (sin LLM). Pensado como tier para cadenas y
 * restaurantes cuya web propia es una app-JS sin menú en el HTML (donde Crawl4AI+LLM
 * sacan carta vacía). Reutiliza el cliente y el `APIFY_TOKEN` de la vertical de empleos.
 *
 * Actores:
 *   - Just Eat: `easyapi/just-eat-restaurant-menu-scraper`  input { restaurantUrl, maxItems }
 *   - Glovo:    `antonionduarte/glovo-scraper`               input { location, storeUrls, includeProducts }
 *
 * ⚠️ El esquema de SALIDA de estos actores no está documentado públicamente, así que el
 * mapeo es DEFENSIVO: prueba varios nombres de campo plausibles para nombre/precio/
 * descripción/categoría. Loguea muestras de los primeros items para poder validar el
 * mapeo contra un run real (los precios sobre todo). Devuelve la forma `ExtractedMenuLike`
 * que `menu-scrape.normalizeMenu` ya sabe normalizar (eurToCents + topes de sanidad).
 */

// Just Eat: el actor devolvió 0 items en pruebas incluso con el ejemplo UK de su doc
// (roto). Se mantiene la rama por si se arregla, pero findDeliveryUrl NO lo selecciona.
const JUST_EAT_ACTOR = "easyapi/just-eat-restaurant-menu-scraper";
const GLOVO_ACTOR = "antonionduarte/glovo-scraper";

// Topes de coste por run (un menú puede pasar de 25 items; subimos respecto al default).
const MENU_MAX_ITEMS = 150;
const MENU_MAX_CHARGE_USD = 0.5;
const MENU_TIMEOUT_SECS = 150;

/** Forma que consume `menu-scrape.normalizeMenu` (categorías → items con precio en euros). */
export type ExtractedMenuLike = {
  categories: { name: string; items: { name: string; description: string | null; priceEur: number | null }[] }[];
};

export type DeliveryPlatform = "justeat" | "glovo";

export function hasApifyMenu(): boolean {
  return hasApifyToken();
}

/** Primer valor string no vacío entre varias claves candidatas. */
function pickStr(obj: ApifyItem, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Extrae un precio en EUROS de formas variadas: número (12.5), string ("9,50 €"),
 * objeto ({ amount: 950 } / { value: "9.5" }). Heurística cents↔euros: si es un entero
 * grande (>=1000) se asume céntimos y se divide por 100; con decimales se asume euros.
 * Devuelve null si no hay precio fiable (normalizeMenu lo descartará).
 */
function pickEur(obj: ApifyItem, keys: string[]): number | null {
  let raw: unknown = null;
  for (const k of keys) {
    if (obj[k] != null) {
      raw = obj[k];
      break;
    }
  }
  // Objetos tipo { amount, value, price }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    raw = o.amount ?? o.value ?? o.price ?? o.eur ?? null;
  }
  let eur: number | null = null;
  if (typeof raw === "number") {
    eur = Number.isInteger(raw) && raw >= 1000 ? raw / 100 : raw; // entero grande → céntimos
  } else if (typeof raw === "string") {
    const cleaned = raw.replace(/[^0-9,.]/g, "").replace(",", ".");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) eur = n;
  }
  return eur != null && Number.isFinite(eur) && eur > 0 ? eur : null;
}

/**
 * Mapea items crudos de un actor a `ExtractedMenuLike`, agrupando por categoría. Para
 * Glovo filtra a `recordType === "product"`. Tolera ausencia de categoría ("Carta").
 */
function mapItemsToMenu(items: ApifyItem[], platform: DeliveryPlatform): ExtractedMenuLike {
  // Muestra para depurar el mapeo contra el esquema real (no documentado).
  if (items.length) {
    console.log(`[food-menu]   apify(${platform}) muestra item:`, JSON.stringify(items[0]).slice(0, 300));
  }
  const byCat = new Map<string, { name: string; description: string | null; priceEur: number | null }[]>();
  for (const it of items) {
    // Glovo emite store + product en el mismo dataset; solo nos interesan los productos.
    const recordType = pickStr(it, ["recordType", "type"]);
    if (platform === "glovo" && recordType && recordType.toLowerCase() !== "product") continue;

    const name = pickStr(it, ["name", "title", "productName", "itemName", "dishName"]);
    if (!name) continue;
    const priceEur = pickEur(it, ["priceEur", "price", "amount", "priceValue", "cost", "unitPrice"]);
    const description = pickStr(it, ["description", "desc", "productDescription", "details", "subtitle"]);
    const category = pickStr(it, ["category", "categoryName", "section", "menuCategory", "group", "categoryTitle"]) ?? "Carta";

    if (!byCat.has(category)) byCat.set(category, []);
    byCat.get(category)!.push({ name, description, priceEur });
  }
  return { categories: [...byCat.entries()].map(([name, catItems]) => ({ name, items: catItems })) };
}

/** Slug de tienda Glovo desde su URL (último segmento de ruta no vacío). */
function glovoSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
}

/**
 * Ejecuta el actor de Apify adecuado para una URL de plataforma de delivery y devuelve
 * la carta estructurada (o null si no hay nada / error controlado arriba). `city` es
 * necesaria para Glovo (su input es por ubicación + slug de tienda).
 */
export async function apifyMenuFromDeliveryUrl(
  platform: DeliveryPlatform,
  url: string,
  city: string,
): Promise<ExtractedMenuLike | null> {
  if (!hasApifyToken()) return null;
  const t = Date.now();
  let items: ApifyItem[] = [];

  if (platform === "justeat") {
    const out = await runActorGetItems(
      JUST_EAT_ACTOR,
      { restaurantUrl: url, maxItems: MENU_MAX_ITEMS },
      { maxItems: MENU_MAX_ITEMS, maxTotalChargeUsd: MENU_MAX_CHARGE_USD, timeoutSecs: MENU_TIMEOUT_SECS },
    );
    items = out.items;
  } else {
    const slug = glovoSlug(url);
    if (!slug) return null;
    // omitChargeGuards: validado en pruebas que CON maxItems/maxTotalChargeUsd en la query
    // el run da 0 items; SIN ellos devuelve la carta. El coste queda acotado igualmente por
    // `maxStoresPerCategory: 1` (una sola tienda ≈ 40-60 productos ≈ $0,15/run).
    const out = await runActorGetItems(
      GLOVO_ACTOR,
      { location: city || "España", storeUrls: [slug], includeProducts: true, maxStoresPerCategory: 1 },
      { timeoutSecs: MENU_TIMEOUT_SECS, omitChargeGuards: true },
    );
    items = out.items;
  }

  const menu = mapItemsToMenu(items, platform);
  const itemCount = menu.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[food-menu]   apify(${platform})=${Date.now() - t}ms items=${items.length} mapeados=${itemCount}`);
  return itemCount > 0 ? menu : null;
}
