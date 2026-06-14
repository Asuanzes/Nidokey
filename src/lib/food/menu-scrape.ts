import { Prisma } from "@prisma/client";
import { slugifyTitle, bigrams, jaccard } from "@nidokey/shared";
import { prisma } from "@/lib/db";
import { apifyGlovoMenu, apifyGlovoCityStores, hasApifyMenu, type GlovoStore } from "@/features/sources/providers/apify-menu";

/**
 * Menús de restaurantes de Google (`source === "google"`) vía Apify/Glovo, DIRECTO y 100%
 * Apify (sin Crawl4AI/LLM/Firecrawl). La carta se cachea en MenuCategory/MenuItem; el
 * scraping corre en un worker desacoplado (cola + cron, lock en BBDD), nunca en la request
 * del usuario: la ficha abre al instante con menuStatus="fetching" y el móvil hace polling.
 *
 * Solo se scrapean COCINAS DE DELIVERY (pizza, hamburguesa, kebab, sushi/asiático, mexicano,
 * pollo/fast-food…), que cubren el grueso de los pedidos a domicilio. El bar de tapas, la
 * cafetería o la marisquería NO se scrapean (filtro por types de Google) → menos coste y BBDD.
 *
 * Flujo por restaurante (worker):
 *   1. URL de tienda Glovo: cacheada (menuSourceUrl) o por MATCH contra el catálogo de la
 *      ciudad (1 listado de Glovo por ciudad, cacheado en BBDD con TTL).
 *   2. Actor de Glovo (productos) → carta estructurada → guardar.
 * Restaurantes NO listados en Glovo se quedan sin carta.
 */

export type MenuStatus = "ready" | "fetching" | "unavailable" | "empty";

const MENU_TTL_MS = 90 * 24 * 60 * 60 * 1000; // refresco de carta muy esporádico
const CATALOG_TTL_MS = 3 * 24 * 60 * 60 * 1000; // catálogo de ciudad: refresco cada 3 días
const MAX_CATEGORIES = 40;
const MAX_ITEMS = 80;
const STALE_FETCH_LOCK_MS = 5 * 60 * 1000; // un FETCHING más viejo = lock muerto reclamable
const MAX_MENU_ATTEMPTS = 3;
const MATCH_MIN_SCORE = 0.6; // umbral de similitud de nombre para casar Google ↔ Glovo

/**
 * Cocinas de delivery (types de Google Places) que cubren ~80-90% de los pedidos a
 * domicilio en España. Solo estos restaurantes se scrapean; el resto se deja sin carta.
 * Editar este set para ampliar/reducir el filtro.
 */
const DELIVERY_CUISINES = new Set([
  // Pizza / italiano
  "pizza_restaurant", "italian_restaurant",
  // Hamburguesa / americano / fast food / pollo
  "hamburger_restaurant", "american_restaurant", "fast_food_restaurant", "meal_takeaway", "meal_delivery",
  // Kebab / turco / oriente medio / griego
  "turkish_restaurant", "middle_eastern_restaurant", "lebanese_restaurant", "greek_restaurant",
  // Sushi / asiático
  "sushi_restaurant", "japanese_restaurant", "ramen_restaurant", "chinese_restaurant",
  "asian_restaurant", "thai_restaurant", "vietnamese_restaurant", "korean_restaurant", "indonesian_restaurant",
  // Mexicano
  "mexican_restaurant",
  // Indio
  "indian_restaurant",
  // Bocadillos / barbacoa / saludable (poke, vegano)
  "sandwich_shop", "barbecue_restaurant", "vegan_restaurant",
]);

function isDeliveryCuisine(types: string[] | null | undefined): boolean {
  return Array.isArray(types) && types.some((t) => DELIVERY_CUISINES.has(t));
}

/** Necesitamos Apify (motor del menú: catálogo + productos). Sin él, "no disponible". */
function canScrapeMenus(): boolean {
  return hasApifyMenu();
}

type ExtractedMenu = {
  categories?: { name?: unknown; items?: { name?: unknown; description?: unknown; priceEur?: unknown; price?: unknown }[] }[];
};
type NormItem = { name: string; description: string | null; priceCents: number };
type NormCat = { name: string; items: NormItem[] };

function eurToCents(val: unknown): number | null {
  let eur: number | null = null;
  if (typeof val === "number") eur = val;
  else if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9,.]/g, "").replace(",", ".");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) eur = n;
  }
  if (eur == null || !Number.isFinite(eur)) return null;
  const cents = Math.round(eur * 100);
  if (cents <= 0 || cents > 100_000) return null; // 0–1000 € por plato
  return cents;
}

/** Normaliza la carta extraída a categorías/items con precio en cents y topes de sanidad. */
function normalizeMenu(extracted: ExtractedMenu | null): NormCat[] {
  const cats = Array.isArray(extracted?.categories) ? extracted!.categories! : [];
  const out: NormCat[] = [];
  for (const c of cats.slice(0, MAX_CATEGORIES)) {
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    if (!name) continue;
    const rawItems = Array.isArray(c?.items) ? c.items : [];
    const items: NormItem[] = [];
    for (const it of rawItems.slice(0, MAX_ITEMS)) {
      const iname = typeof it?.name === "string" ? it.name.trim() : "";
      const cents = eurToCents(it?.priceEur ?? it?.price);
      if (!iname || cents == null) continue;
      const desc = typeof it?.description === "string" ? it.description.trim().slice(0, 500) : "";
      items.push({ name: iname.slice(0, 200), description: desc || null, priceCents: cents });
    }
    if (items.length) out.push({ name: name.slice(0, 120), items });
  }
  return out;
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** ¿Es ya una URL de TIENDA de Glovo? (para reusar en refrescos sin tocar el catálogo). */
function isGlovoStoreUrl(u: string | null): boolean {
  return Boolean(u && hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/"));
}

/**
 * Catálogo de tiendas de Glovo de una ciudad, cacheado en BBDD (TTL). Una sola llamada al
 * actor por ciudad cada CATALOG_TTL_MS; el resto de restaurantes de esa ciudad reusan la caché.
 */
async function getGlovoCatalog(city: string): Promise<GlovoStore[]> {
  const key = city.trim().toLowerCase();
  if (!key) return [];
  const cached = await prisma.glovoCatalog.findUnique({ where: { city: key } }).catch(() => null);
  if (cached && Date.now() - cached.fetchedAt.getTime() < CATALOG_TTL_MS) {
    return Array.isArray(cached.stores) ? (cached.stores as unknown as GlovoStore[]) : [];
  }
  const stores = await apifyGlovoCityStores(city);
  if (stores.length) {
    await prisma.glovoCatalog
      .upsert({
        where: { city: key },
        create: { city: key, stores: stores as unknown as Prisma.InputJsonValue, fetchedAt: new Date() },
        update: { stores: stores as unknown as Prisma.InputJsonValue, fetchedAt: new Date() },
      })
      .catch(() => {});
  }
  return stores;
}

/** Casa un restaurante (nombre de Google) con una tienda del catálogo Glovo por similitud de nombre. */
function matchGlovoStore(name: string, stores: GlovoStore[]): GlovoStore | null {
  const target = slugifyTitle(name);
  if (!target) return null;
  const tb = bigrams(target);
  let best: GlovoStore | null = null;
  let bestScore = 0;
  for (const s of stores) {
    const st = slugifyTitle(s.title);
    if (!st) continue;
    let score: number;
    if (st === target) score = 1;
    else if (target.includes(st) || st.includes(target)) score = 0.9;
    else score = jaccard(tb, bigrams(st));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore >= MATCH_MIN_SCORE ? best : null;
}

/**
 * Resuelve la tienda Glovo (cacheada o por match contra el catálogo de la ciudad) → corre
 * el actor de productos → guarda la carta. READY (con items) o EMPTY. NO toca menuStatus.
 */
async function scrapeAndStore(r: {
  id: string;
  name: string;
  city: string;
  menuSourceUrl: string | null;
}): Promise<{ status: "READY" | "EMPTY"; items: number }> {
  const t0 = Date.now();
  let glovoUrl = isGlovoStoreUrl(r.menuSourceUrl) ? r.menuSourceUrl! : null;
  if (!glovoUrl) {
    const stores = await getGlovoCatalog(r.city);
    glovoUrl = matchGlovoStore(r.name, stores)?.url ?? null;
  }
  const tFind = Date.now() - t0;
  if (!glovoUrl) {
    console.log(`[food-menu] ${r.id} match=${tFind}ms → no está en Glovo ("${r.name}", ${r.city})`);
    return { status: "EMPTY", items: 0 };
  }

  const te = Date.now();
  const cats = normalizeMenu(await apifyGlovoMenu(glovoUrl, r.city));
  const tApify = Date.now() - te;
  if (cats.length === 0) {
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuSourceUrl: glovoUrl } }).catch(() => {});
    console.log(`[food-menu] ${r.id} match=${tFind}ms apify=${tApify}ms → carta vacía ("${r.name}")`);
    return { status: "EMPTY", items: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { restaurantId: r.id } });
    await tx.menuCategory.deleteMany({ where: { restaurantId: r.id } });
    for (let ci = 0; ci < cats.length; ci++) {
      const cat = cats[ci];
      await tx.menuCategory.create({
        data: {
          restaurantId: r.id,
          name: cat.name,
          sortOrder: ci,
          items: {
            create: cat.items.map((it, ii) => ({
              restaurantId: r.id,
              name: it.name,
              description: it.description,
              priceCents: it.priceCents,
              sortOrder: ii,
            })),
          },
        },
      });
    }
    await tx.restaurant.update({ where: { id: r.id }, data: { menuSourceUrl: glovoUrl } });
  });
  const items = cats.reduce((n, c) => n + c.items.length, 0);
  console.log(`[food-menu] ${r.id} match=${tFind}ms apify=${tApify}ms → READY ${cats.length} cats / ${items} platos ("${r.name}")`);
  return { status: "READY", items };
}

type TerminalStatus = "READY" | "EMPTY" | "FAILED";

/**
 * Procesa UN restaurante de la cola. Claim ATÓMICO (PENDING→FETCHING, o reclama un FETCHING
 * colgado): updateMany con guard = exclusión mutua a nivel de fila en Postgres, entre
 * instancias. Devuelve el estado terminal, o null si no pudo hacer claim. Seguro desde el
 * cron Y desde un after() fast-path.
 */
export async function processMenu(restaurantId: string): Promise<TerminalStatus | null> {
  const staleBefore = new Date(Date.now() - STALE_FETCH_LOCK_MS);
  const claim = await prisma.restaurant.updateMany({
    where: {
      id: restaurantId,
      source: "google",
      OR: [{ menuStatus: "PENDING" }, { menuStatus: "FETCHING", menuQueuedAt: { lt: staleBefore } }],
    },
    data: { menuStatus: "FETCHING", menuQueuedAt: new Date() },
  });
  if (claim.count === 0) return null;

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, city: true, menuSourceUrl: true, source: true, menuAttempts: true },
  });
  if (!r || r.source !== "google") return null;

  if (!canScrapeMenus()) {
    await prisma.restaurant
      .update({ where: { id: r.id }, data: { menuStatus: "FAILED", menuFetchedAt: new Date() } })
      .catch(() => {});
    return "FAILED";
  }

  try {
    const { status } = await scrapeAndStore(r);
    await prisma.restaurant.update({
      where: { id: r.id },
      data: { menuStatus: status, menuFetchedAt: new Date(), menuAttempts: r.menuAttempts + 1 },
    });
    return status;
  } catch (e) {
    console.error(`[food-menu] ${r.id} scrape falló:`, e instanceof Error ? e.message : e);
    const attempts = r.menuAttempts + 1;
    const next: "FAILED" | "PENDING" = attempts >= MAX_MENU_ATTEMPTS ? "FAILED" : "PENDING";
    await prisma.restaurant
      .update({ where: { id: r.id }, data: { menuStatus: next, menuFetchedAt: new Date(), menuAttempts: attempts } })
      .catch(() => {});
    return next === "FAILED" ? "FAILED" : null;
  }
}

/**
 * Estado del menú para la respuesta de la ficha (contrato del móvil), SIN efectos. El
 * encolado lo hace `enqueueMenu`. Cocina no-delivery (y sin carta) → "unavailable" (no se
 * scrapea). Stale-while-revalidate: si hay carta cacheada se muestra ("ready").
 */
export function menuStatusFor(r: {
  source: string | null;
  menuStatus: string | null;
  hasMenu: boolean;
  cuisineTypes?: string[] | null;
}): MenuStatus {
  if (r.source !== "google") return r.hasMenu ? "ready" : "empty";
  if (r.hasMenu) return "ready";
  if (!isDeliveryCuisine(r.cuisineTypes) && r.menuStatus == null) return "unavailable"; // filtrado por cocina
  switch (r.menuStatus) {
    case "PENDING":
    case "FETCHING":
      return "fetching";
    case "EMPTY":
    case "FAILED":
      return "unavailable";
    default:
      return "fetching";
  }
}

/**
 * Encola (marca PENDING) el menú si lo necesita: google + cocina de delivery + sin carta
 * fresca + no ya en cola/proceso. Barato (1 UPDATE con guard). Devuelve true si encoló.
 */
export async function enqueueMenu(r: {
  id: string;
  source: string | null;
  menuStatus: string | null;
  menuFetchedAt: Date | null;
  hasMenu: boolean;
  cuisineTypes?: string[] | null;
}): Promise<boolean> {
  if (r.source !== "google" || !canScrapeMenus()) return false;
  if (!isDeliveryCuisine(r.cuisineTypes)) return false; // filtro: solo cocinas de delivery
  if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
  const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
  if (fresh) return false;
  const res = await prisma.restaurant.updateMany({
    where: { id: r.id, source: "google", NOT: { menuStatus: { in: ["PENDING", "FETCHING"] } } },
    data: { menuStatus: "PENDING", menuQueuedAt: new Date() },
  });
  return res.count > 0;
}

/**
 * Encola (marca PENDING) los menús de los `limit` primeros restaurantes de Google de
 * COCINA DE DELIVERY sin carta fresca. NO scrapea — eso lo hace el worker.
 */
export async function enqueueMenusForList(
  restaurants: { id: string; source: string | null; menuFetchedAt: Date | null; menuStatus?: string | null; types?: string[] }[],
  limit = 6,
): Promise<string[]> {
  if (!canScrapeMenus()) return [];
  const candidates = restaurants.filter((r) => {
    if (r.source !== "google") return false;
    if (!isDeliveryCuisine(r.types)) return false; // filtro de cocinas
    if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
    const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
    return !fresh;
  });
  const targets = candidates.slice(0, limit).map((r) => r.id);
  if (targets.length === 0) return [];
  await prisma.restaurant.updateMany({
    where: { id: { in: targets }, source: "google", NOT: { menuStatus: { in: ["PENDING", "FETCHING"] } } },
    data: { menuStatus: "PENDING", menuQueuedAt: new Date() },
  });
  console.log(`[food-menu] encolados ${targets.length} restaurantes para el worker`);
  return targets;
}

/**
 * Worker de la cola (lo invoca el cron). Reclama hasta `limit` restaurantes PENDING (o
 * FETCHING colgados, por antigüedad) y los procesa SECUENCIALMENTE via processMenu (claim
 * atómico → sin duplicados entre instancias).
 */
export async function runMenuQueue(opts: { limit?: number } = {}): Promise<{
  processed: number;
  ready: number;
  empty: number;
  failed: number;
  skipped: number;
}> {
  const out = { processed: 0, ready: 0, empty: 0, failed: 0, skipped: 0 };
  if (!canScrapeMenus()) return out;
  const limit = opts.limit ?? 8;
  const stale = new Date(Date.now() - STALE_FETCH_LOCK_MS);
  const queued = await prisma.restaurant.findMany({
    where: {
      source: "google",
      OR: [{ menuStatus: "PENDING" }, { menuStatus: "FETCHING", menuQueuedAt: { lt: stale } }],
    },
    orderBy: { menuQueuedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const { id } of queued) {
    const status = await processMenu(id);
    if (status === null) {
      out.skipped++;
      continue;
    }
    out.processed++;
    if (status === "READY") out.ready++;
    else if (status === "EMPTY") out.empty++;
    else out.failed++;
  }
  console.log(`[food-menu] worker: ${JSON.stringify(out)}`);
  return out;
}
