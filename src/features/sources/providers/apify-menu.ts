import { hasApifyToken, runActorGetItems, type ApifyItem } from "./apify";

/**
 * Menús de GLOVO vía actor de Apify (`antonionduarte/glovo-scraper`), que devuelve la
 * carta YA ESTRUCTURADA. Es la ÚNICA fuente de menús: el usuario paga la suscripción de
 * Apify para esto y no queremos pasos intermedios (Crawl4AI/LLM) que ralenticen.
 *
 * Just Eat se descartó: su actor (`easyapi/...`) devolvía 0 items incluso con el ejemplo
 * UK de su doc (roto) y cobraba igual → gasto inútil. No se llama.
 *
 * Esquema de salida real (validado, KFC/Goiko Oviedo):
 *   { storeSlug, storeName, name, price (número en EUR), description, currency, productId,
 *     imageUrl, recordType:"product" }
 * Glovo NO trae categorías → todos los platos caen en una sección "Carta".
 *
 * omitChargeGuards: validado que CON maxItems/maxTotalChargeUsd en la query el run da 0
 * items; SIN ellos devuelve la carta. El coste queda acotado por `maxStoresPerCategory:1`.
 */

const GLOVO_ACTOR = "antonionduarte/glovo-scraper";
const MENU_TIMEOUT_SECS = 150;

/** Forma que consume `menu-scrape.normalizeMenu` (categorías → items con precio en euros). */
export type ExtractedMenuLike = {
  categories: { name: string; items: { name: string; description: string | null; priceEur: number | null }[] }[];
};

export function hasApifyMenu(): boolean {
  return hasApifyToken();
}

/** Primer valor string no vacío entre varias claves candidatas (mapeo defensivo). */
function pickStr(obj: ApifyItem, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Precio en EUROS de formas variadas: número (10.85), string ("9,50 €"), objeto
 * ({ amount } / { value }). Heurística cents↔euros: entero grande (>=1000) → céntimos.
 */
function pickEur(obj: ApifyItem, keys: string[]): number | null {
  let raw: unknown = null;
  for (const k of keys) {
    if (obj[k] != null) {
      raw = obj[k];
      break;
    }
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    raw = o.amount ?? o.value ?? o.price ?? o.eur ?? null;
  }
  let eur: number | null = null;
  if (typeof raw === "number") {
    eur = Number.isInteger(raw) && raw >= 1000 ? raw / 100 : raw;
  } else if (typeof raw === "string") {
    const cleaned = raw.replace(/[^0-9,.]/g, "").replace(",", ".");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) eur = n;
  }
  return eur != null && Number.isFinite(eur) && eur > 0 ? eur : null;
}

/** Mapea items del actor de Glovo a `ExtractedMenuLike`. Filtra a productos; sin categoría → "Carta". */
function mapItemsToMenu(items: ApifyItem[]): ExtractedMenuLike {
  if (items.length) {
    console.log(`[food-menu]   apify(glovo) muestra item:`, JSON.stringify(items[0]).slice(0, 300));
  }
  const byCat = new Map<string, { name: string; description: string | null; priceEur: number | null }[]>();
  for (const it of items) {
    const recordType = pickStr(it, ["recordType", "type"]);
    if (recordType && recordType.toLowerCase() !== "product") continue; // Glovo emite store+product
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
 * Corre el actor de Glovo para una URL de tienda y devuelve la carta estructurada (o null
 * si no hay nada / error). `city` alimenta el input del actor (su búsqueda es por ubicación).
 */
export async function apifyGlovoMenu(url: string, city: string): Promise<ExtractedMenuLike | null> {
  if (!hasApifyToken()) return null;
  const slug = glovoSlug(url);
  if (!slug) return null;
  const t = Date.now();
  const out = await runActorGetItems(
    GLOVO_ACTOR,
    { location: city || "España", storeUrls: [slug], includeProducts: true, maxStoresPerCategory: 1 },
    { timeoutSecs: MENU_TIMEOUT_SECS, omitChargeGuards: true },
  );
  const menu = mapItemsToMenu(out.items);
  const itemCount = menu.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[food-menu]   apify(glovo)=${Date.now() - t}ms items=${out.items.length} mapeados=${itemCount}`);
  return itemCount > 0 ? menu : null;
}
