import { hasApifyToken, runActorGetItems, type ApifyItem } from "./apify";

/**
 * Menús de GLOVO vía actor de Apify `gooyer.co/glovo-scraper`, que scrapea una URL de
 * tienda directamente (input `startUrls`) SIN campo de ubicación → no depende de ningún
 * "GeoNamesCache" y funciona en CUALQUIER ciudad (validado en Vitoria, donde los actores
 * `antonionduarte` y `blagoysimandoff` fallaban). Es la única fuente de menús.
 *
 * Salida: el actor devuelve el árbol crudo de la página de Glovo. Los PLATOS son records
 * de producto con `{ id, name, description, price, priceInfo:{amount}, attributeGroups }`.
 * Los modificadores/extras viven DENTRO de `attributeGroups` de cada plato → NO se
 * descienden (si no, se cuelan como platos: el recursivo ingenuo sacaba 353 vs 72 reales).
 * v1: carta plana en una sección "Carta" (categorías = pulido posterior, requieren
 * correlacionar el layout `sections`). Extras = fase posterior.
 */

const GLOVO_ACTOR = "gooyer.co/glovo-scraper";
const MENU_TIMEOUT_SECS = 220;

/** Forma que consume `menu-scrape.normalizeMenu` (categorías → items con precio en euros). */
export type ExtractedMenuLike = {
  categories: { name: string; items: { name: string; description: string | null; priceEur: number | null }[] }[];
};

export function hasApifyMenu(): boolean {
  return hasApifyToken();
}

/** Precio en euros desde priceInfo.amount (número) o price; tolera string "9,50 €". */
function priceEurOf(p: ApifyItem): number | null {
  const info = p.priceInfo as { amount?: unknown } | undefined;
  const raw = (info && info.amount != null ? info.amount : p.price) as unknown;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(/[^0-9,.]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** ¿Es un record de PLATO? (nombre + precio + id; NO un badge/sección/store header). */
function isProduct(it: ApifyItem): boolean {
  return typeof it.name === "string" && it.name.trim().length > 0 && it.priceInfo != null && it.id != null;
}

/**
 * Scrapea la carta de una URL de tienda Glovo y devuelve los platos en una sección
 * "Carta" (limpia, sin modificadores). null si no hay platos / error.
 */
export async function apifyGlovoMenu(url: string): Promise<ExtractedMenuLike | null> {
  if (!hasApifyToken()) return null;
  const t = Date.now();
  // omitChargeGuards: gooyer no usa maxItems en query; el coste lo acota una sola tienda
  // (followStoreLinks/fetchFullProductPages en false → no sigue a otras tiendas ni a fichas).
  const out = await runActorGetItems(
    GLOVO_ACTOR,
    {
      startUrls: [{ url }],
      followStoreLinks: false,
      fetchFullProductPages: false,
      proxyConfiguration: { useApifyProxy: true },
    },
    { timeoutSecs: MENU_TIMEOUT_SECS, omitChargeGuards: true },
  );

  const items: { name: string; description: string | null; priceEur: number | null }[] = [];
  const seen = new Set<string>();
  for (const it of out.items) {
    if (!isProduct(it)) continue; // ignora badges, secciones, store header y modificadores anidados
    const name = String(it.name).trim();
    const key = String(it.id ?? name);
    if (seen.has(key)) continue;
    seen.add(key);
    const priceEur = priceEurOf(it);
    if (priceEur == null) continue;
    const description = typeof it.description === "string" && it.description.trim() ? it.description.trim() : null;
    items.push({ name, description, priceEur });
  }
  console.log(`[food-menu]   apify(gooyer)=${Date.now() - t}ms records=${out.items.length} platos=${items.length}`);
  if (items.length === 0) return null;
  return { categories: [{ name: "Carta", items }] };
}
