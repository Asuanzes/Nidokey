import { prisma } from "@/lib/db";
import { firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";
import { apifyGlovoMenu, hasApifyMenu } from "@/features/sources/providers/apify-menu";

/**
 * Menús de restaurantes de Google (`source === "google"`) vía Apify/Glovo, DIRECTO: sin
 * pasos intermedios (Crawl4AI/LLM/Firecrawl-scrape retirados — ralentizaban y la carta de
 * cadenas no está en su web). La carta se cachea en MenuCategory/MenuItem; el scraping
 * corre en un worker desacoplado (cola + cron, lock en BBDD), nunca en la request del
 * usuario: la ficha abre al instante con menuStatus="fetching" y el móvil hace polling.
 *
 * Flujo por restaurante:
 *   1. URL de tienda Glovo: cacheada (menuSourceUrl) o vía 1 búsqueda (Firecrawl search).
 *   2. Actor de Glovo (Apify) → carta estructurada → guardar.
 * Restaurantes NO listados en Glovo se quedan sin carta (no hay otra fuente ahora).
 */

export type MenuStatus = "ready" | "fetching" | "unavailable" | "empty";

// Caché casi permanente: la carta se reutiliza desde nuestra BBDD y solo se vuelve a
// scrapear on-demand (botón "Actualizar carta" → /refresh-menu invalida esto). 90 días.
const MENU_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CATEGORIES = 40;
const MAX_ITEMS = 80;
// Un FETCHING más viejo que esto se considera lock muerto (lambda reciclado) y reclamable.
const STALE_FETCH_LOCK_MS = 5 * 60 * 1000;
// Tras N fallos consecutivos, FAILED (terminal): no re-encolar en auto.
const MAX_MENU_ATTEMPTS = 3;

/**
 * ¿Podemos scrapear menús? Necesitamos Apify (motor del menú) y Firecrawl (solo para una
 * búsqueda barata que localiza la URL de la tienda en Glovo la primera vez). Sin ambos,
 * las cartas de Google quedan como "no disponible".
 */
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

/** ¿Es ya una URL de TIENDA de Glovo (no una página de marca)? */
function isGlovoStoreUrl(u: string | null): boolean {
  return Boolean(u && hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/"));
}

/**
 * Localiza la URL de la tienda del restaurante en Glovo vía Firecrawl search. Prefiere la
 * URL de TIENDA (/stores/...), no las páginas de marca (/glovo-delivery/...), que no dan
 * menú. null si no aparece (restaurante no listado en Glovo o sin Firecrawl para buscar).
 */
async function findGlovoUrl(name: string, city: string): Promise<string | null> {
  if (!hasFirecrawlKey()) return null;
  const results = (await firecrawlSearch(`${name} ${city} glovo`, 10).catch(() => [])).filter((r) => isSafeWebUrl(r.url));
  return results.map((r) => r.url).find((u) => hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/")) ?? null;
}

/**
 * Resuelve la URL de Glovo (cacheada o por búsqueda) → corre el actor → guarda la carta.
 * Devuelve READY (con items) o EMPTY. NO toca menuStatus (lo hace processMenu). Emite tiempos.
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
  const cats = normalizeMenu(await apifyGlovoMenu(glovoUrl, r.city));
  const tApify = Date.now() - te;
  if (cats.length === 0) {
    // Cachea la URL aunque venga vacía para no re-buscarla cada vez (TTL la refresca).
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
 * Procesa UN restaurante de la cola. Claim ATÓMICO (PENDING→FETCHING, o reclama un
 * FETCHING colgado): updateMany con guard = exclusión mutua a nivel de fila en Postgres,
 * funciona ENTRE INSTANCIAS. Devuelve el estado terminal, o null si no pudo hacer claim
 * (otro worker lo tiene). Seguro desde el cron Y desde un after() fast-path.
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
  if (claim.count === 0) return null; // otro lo tiene, o no procede

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
 * encolado lo hace `enqueueMenu`. Stale-while-revalidate: si hay carta cacheada se
 * muestra ("ready") aunque esté stale; el refresco va por detrás.
 */
export function menuStatusFor(r: { source: string | null; menuStatus: string | null; hasMenu: boolean }): MenuStatus {
  if (r.source !== "google") return r.hasMenu ? "ready" : "empty";
  if (r.hasMenu) return "ready";
  switch (r.menuStatus) {
    case "PENDING":
    case "FETCHING":
      return "fetching";
    case "EMPTY":
    case "FAILED":
      return "unavailable";
    default:
      return "fetching"; // null / recién encolado → "preparando"
  }
}

/**
 * Encola (marca PENDING) el menú de un restaurante si lo necesita: google + sin carta
 * fresca + no ya en cola/proceso. Barato (1 UPDATE con guard). Devuelve true si encoló.
 */
export async function enqueueMenu(r: {
  id: string;
  source: string | null;
  menuStatus: string | null;
  menuFetchedAt: Date | null;
  hasMenu: boolean;
}): Promise<boolean> {
  if (r.source !== "google" || !canScrapeMenus()) return false;
  if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
  const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
  if (fresh) return false;
  const res = await prisma.restaurant.updateMany({
    where: { id: r.id, source: "google", NOT: { menuStatus: { in: ["PENDING", "FETCHING"] } } },
    data: { menuStatus: "PENDING", menuQueuedAt: new Date() },
  });
  return res.count > 0;
}

// Tipos de Google Places (cocinas) que más se piden a domicilio → se encolan primero.
const POPULAR_DELIVERY_TYPES = new Set([
  "pizza_restaurant",
  "hamburger_restaurant",
  "fast_food_restaurant",
  "mexican_restaurant",
  "sushi_restaurant",
  "japanese_restaurant",
  "chinese_restaurant",
  "asian_restaurant",
  "thai_restaurant",
  "indian_restaurant",
  "turkish_restaurant",
  "italian_restaurant",
  "american_restaurant",
  "kebab_restaurant",
  "meal_delivery",
  "meal_takeaway",
]);

function isPopularDelivery(types: string[] | undefined): boolean {
  return Array.isArray(types) && types.some((t) => POPULAR_DELIVERY_TYPES.has(t));
}

/**
 * Encola (marca PENDING) los menús de los `limit` primeros restaurantes de Google sin
 * carta fresca, priorizando cocinas de delivery. NO scrapea — eso lo hace el worker.
 */
export async function enqueueMenusForList(
  restaurants: { id: string; source: string | null; menuFetchedAt: Date | null; menuStatus?: string | null; types?: string[] }[],
  limit = 6,
): Promise<string[]> {
  if (!canScrapeMenus()) return [];
  const candidates = restaurants.filter((r) => {
    if (r.source !== "google") return false;
    if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false;
    const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
    return !fresh;
  });
  const popular = candidates.filter((r) => isPopularDelivery(r.types));
  const rest = candidates.filter((r) => !isPopularDelivery(r.types));
  const targets = [...popular, ...rest].slice(0, limit).map((r) => r.id);
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
 * FETCHING colgados, en orden de antigüedad) y los procesa SECUENCIALMENTE. Cada uno via
 * processMenu (claim atómico → sin duplicados entre instancias).
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
