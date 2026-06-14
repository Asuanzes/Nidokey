import { firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";
import { prisma } from "@/lib/db";
import { apifyGlovoMenu, hasApifyMenu } from "@/features/sources/providers/apify-menu";

/**
 * Menús de restaurantes de Google (`source === "google"`) vía Apify/Glovo (actor
 * `gooyer.co/glovo-scraper`, por URL → funciona en cualquier ciudad). La carta se cachea
 * en MenuCategory/MenuItem; el scraping corre en un worker desacoplado (cola + cron, lock
 * en BBDD), nunca en la request del usuario: la ficha abre al instante con
 * menuStatus="fetching" y el móvil hace polling.
 *
 * Solo se scrapean COCINAS DE DELIVERY (pizza, hamburguesa, kebab, sushi/asiático,
 * mexicano, pollo/fast-food…). El bar de tapas/cafetería/marisquería NO se scrapean.
 *
 * Flujo por restaurante (worker):
 *   1. URL de tienda Glovo: cacheada (menuSourceUrl) o por búsqueda (Firecrawl search).
 *   2. Actor gooyer (por URL) → platos → guardar.
 * Restaurantes NO listados en Glovo se quedan sin carta.
 */

export type MenuStatus = "ready" | "fetching" | "unavailable" | "empty";

const MENU_TTL_MS = 90 * 24 * 60 * 60 * 1000; // refresco de carta muy esporádico
const MAX_CATEGORIES = 40;
const MAX_ITEMS = 120;
const STALE_FETCH_LOCK_MS = 5 * 60 * 1000; // un FETCHING más viejo = lock muerto reclamable
const MAX_MENU_ATTEMPTS = 3;
// Reintento de los que salieron SIN carta (EMPTY/FAILED): no machacar en cada apertura,
// pero reintentar pasado este tiempo (Glovo puede haber añadido la tienda).
const EMPTY_RETRY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * ¿Hay que (re)scrapear? Solo se SALTA si:
 *  - ya hay carta y es fresca (< MENU_TTL), o
 *  - se intentó hace muy poco y salió vacía (EMPTY/FAILED).
 * Clave: un `menuFetchedAt` viejo SIN carta (estado basura del pipeline anterior: fecha
 * puesta pero 0 platos) NO debe bloquear — ese era el bug por el que el GET volvía 200 sin
 * scrapear nada.
 */
function needsScrape(hasMenu: boolean, menuStatus: string | null, menuFetchedAt: Date | null): boolean {
  const age = menuFetchedAt ? Date.now() - menuFetchedAt.getTime() : Infinity;
  if (hasMenu && age < MENU_TTL_MS) return false;
  if (!hasMenu && (menuStatus === "EMPTY" || menuStatus === "FAILED") && age < EMPTY_RETRY_MS) return false;
  return true;
}

/**
 * Cocinas de delivery (types de Google Places) que cubren ~80-90% de los pedidos a
 * domicilio en España. Solo estos se scrapean; el resto se deja sin carta. Editable.
 */
const DELIVERY_CUISINES = new Set([
  "pizza_restaurant", "italian_restaurant",
  "hamburger_restaurant", "american_restaurant", "fast_food_restaurant", "meal_takeaway", "meal_delivery",
  "turkish_restaurant", "middle_eastern_restaurant", "lebanese_restaurant", "greek_restaurant",
  "sushi_restaurant", "japanese_restaurant", "ramen_restaurant", "chinese_restaurant",
  "asian_restaurant", "thai_restaurant", "vietnamese_restaurant", "korean_restaurant", "indonesian_restaurant",
  "mexican_restaurant",
  "indian_restaurant",
  "sandwich_shop", "barbecue_restaurant", "vegan_restaurant",
]);

export function isDeliveryCuisine(types: string[] | null | undefined): boolean {
  return Array.isArray(types) && types.some((t) => DELIVERY_CUISINES.has(t));
}

/** Necesitamos Apify (motor del menú) y Firecrawl (búsqueda de la URL de tienda). */
function canScrapeMenus(): boolean {
  return hasApifyMenu() && hasFirecrawlKey();
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

/** URL http/https pública (defensa anti-SSRF + filtra internas). */
function isSafeWebUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h === "::1" || h.endsWith(".local")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

/** ¿Es ya una URL de TIENDA de Glovo? (para reusar en refrescos sin re-buscar). */
function isGlovoStoreUrl(u: string | null): boolean {
  return Boolean(u && hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/"));
}

/**
 * Localiza la URL de tienda del restaurante en Glovo vía Firecrawl search. Prefiere la URL
 * de TIENDA (/stores/...), no las de marca (/glovo-delivery/...), que no dan menú. null si
 * no aparece (no listado en Glovo o sin Firecrawl para buscar).
 */
async function findGlovoUrl(name: string, city: string): Promise<string | null> {
  if (!hasFirecrawlKey()) return null;
  const results = (await firecrawlSearch(`${name} ${city} glovo`, 10).catch(() => [])).filter((r) => isSafeWebUrl(r.url));
  return results.map((r) => r.url).find((u) => hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/")) ?? null;
}

/**
 * Resuelve la URL de tienda Glovo (cacheada o por búsqueda) → scrapea la carta con el
 * actor gooyer → guarda. READY (con items) o EMPTY. NO toca menuStatus. Emite tiempos.
 */
async function scrapeAndStore(r: {
  id: string;
  name: string;
  city: string;
  menuSourceUrl: string | null;
}): Promise<{ status: "READY" | "EMPTY"; items: number }> {
  const t0 = Date.now();
  const glovoUrl = isGlovoStoreUrl(r.menuSourceUrl) ? r.menuSourceUrl! : await findGlovoUrl(r.name, r.city);
  const tFind = Date.now() - t0;
  if (!glovoUrl) {
    console.log(`[food-menu] ${r.id} findGlovo=${tFind}ms → no está en Glovo ("${r.name}", ${r.city})`);
    return { status: "EMPTY", items: 0 };
  }

  const te = Date.now();
  const cats = normalizeMenu(await apifyGlovoMenu(glovoUrl));
  const tApify = Date.now() - te;
  if (cats.length === 0) {
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuSourceUrl: glovoUrl } }).catch(() => {});
    console.log(`[food-menu] ${r.id} findGlovo=${tFind}ms apify=${tApify}ms → carta vacía ("${r.name}")`);
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
  console.log(`[food-menu] ${r.id} findGlovo=${tFind}ms apify=${tApify}ms → READY ${cats.length} cats / ${items} platos ("${r.name}")`);
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
 * Estado del menú para la respuesta de la ficha (contrato del móvil), SIN efectos. Cocina
 * no-delivery (y sin carta) → "unavailable" (no se scrapea). Stale-while-revalidate: si
 * hay carta cacheada se muestra ("ready").
 */
export function menuStatusFor(r: {
  source: string | null;
  menuStatus: string | null;
  hasMenu: boolean;
  cuisineTypes?: string[] | null;
}): MenuStatus {
  if (r.source !== "google") return r.hasMenu ? "ready" : "empty";
  if (r.hasMenu) return "ready";
  if (!isDeliveryCuisine(r.cuisineTypes) && r.menuStatus == null) return "unavailable";
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
  if (!isDeliveryCuisine(r.cuisineTypes)) return false;
  if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
  if (!needsScrape(r.hasMenu, r.menuStatus, r.menuFetchedAt)) return false;
  const res = await prisma.restaurant.updateMany({
    // OJO: NOT-IN excluye filas con menuStatus NULL (semántica SQL de NULL) → hay que
    // permitir NULL explícitamente, si no los recién descubiertos (status null) nunca se encolan.
    where: { id: r.id, source: "google", OR: [{ menuStatus: null }, { menuStatus: { notIn: ["PENDING", "FETCHING"] } }] },
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
    if (!isDeliveryCuisine(r.types)) return false;
    if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
    // Sin hasMenu por fila aquí; usamos menuStatus==="READY" como proxy de "tiene carta".
    return needsScrape(r.menuStatus === "READY", r.menuStatus ?? null, r.menuFetchedAt ?? null);
  });
  const targets = candidates.slice(0, limit).map((r) => r.id);
  if (targets.length === 0) return [];
  await prisma.restaurant.updateMany({
    where: { id: { in: targets }, source: "google", OR: [{ menuStatus: null }, { menuStatus: { notIn: ["PENDING", "FETCHING"] } }] },
    data: { menuStatus: "PENDING", menuQueuedAt: new Date() },
  });
  console.log(`[food-menu] encolados ${targets.length} restaurantes para el worker`);
  return targets;
}

/**
 * Worker de la cola (lo invoca el cron). Reclama hasta `limit` restaurantes PENDING (o
 * FETCHING colgados, por antigüedad) y los procesa SECUENCIALMENTE via processMenu.
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
