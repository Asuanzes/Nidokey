import { prisma } from "@/lib/db";
import { firecrawlScrapeJson, firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";
import { placeWebsite } from "@/features/sources/providers/google-places";
import { crawl4aiCrawl, crawl4aiMarkdown, hasCrawl4aiConfig, type Crawl4aiLink } from "@/features/sources/providers/crawl4ai";
import { extractJson, hasLlmExtractor } from "@/features/sources/providers/llm-extract";
import { apifyMenuFromDeliveryUrl, hasApifyMenu, type DeliveryPlatform } from "@/features/sources/providers/apify-menu";

/**
 * Menús reales por scraping (Firecrawl). Solo para restaurantes descubiertos por
 * Google (`source === "google"`); los del seed conservan su menú manual. La carta
 * se cachea en MenuCategory/MenuItem con TTL (Restaurant.menuFetchedAt); se refresca
 * on-demand al abrir la ficha. El scraping corre en background (after()), nunca
 * bloquea la respuesta: la ficha abre al instante con menuStatus="fetching" y el
 * móvil hace polling hasta "ready"/"unavailable".
 */

export type MenuStatus = "ready" | "fetching" | "unavailable" | "empty";

// Caché casi permanente: la carta se reutiliza desde nuestra BBDD y solo se vuelve a
// scrapear on-demand (botón "Actualizar carta" → /refresh-menu invalida esto). 90 días
// = refresco automático muy esporádico; el coste de scraping tiende a 1 vez por sitio.
const MENU_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CATEGORIES = 40;
const MAX_ITEMS = 80;
// Plataformas de delivery en España, por orden de preferencia.
const DELIVERY_DOMAINS = ["glovoapp.com", "just-eat.es", "justeat.es", "ubereats.com"];

/**
 * ¿Podemos scrapear menús? Con Crawl4AI+LLM (gratis, web propia del restaurante),
 * con Apify (Glovo/Just Eat estructurado — necesita Firecrawl para hallar la URL) o
 * con Firecrawl (respaldo de pago). Si no hay ninguno, las cartas de Google quedan
 * como "no disponible".
 */
function canScrapeMenus(): boolean {
  return (
    hasFirecrawlKey() ||
    (hasCrawl4aiConfig() && hasLlmExtractor()) ||
    (hasApifyMenu() && hasFirecrawlKey())
  );
}

const MENU_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                priceEur: { type: "number" },
              },
              required: ["name", "priceEur"],
            },
          },
        },
        required: ["name", "items"],
      },
    },
  },
  required: ["categories"],
};

const MENU_PROMPT =
  "Extrae la carta de comida a domicilio de este restaurante: las categorías y, dentro de cada una, sus platos con nombre, descripción y precio en euros (como número). Ignora cabeceras, banners y elementos que no sean platos.";

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

const MENU_INPUT_CHARS = 12000;
/**
 * Condensa el markdown de una web a lo relevante del menú: titulares (#) + líneas con
 * precio (€ / 9,50) + sus vecinas (el nombre del plato suele ir en la línea anterior).
 * Reduce mucho los tokens enviados al LLM (evita 413/429 de free tier) y enfoca la
 * extracción en la carta en vez de en el ruido de la página.
 */
function condenseMenuMarkdown(md: string): string {
  const lines = md.split("\n");
  const priceRe = /(\d{1,3}(?:[.,]\d{1,2})?\s*€|€\s*\d|\b\d{1,2}[.,]\d{2}\b)/;
  const keep = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i].trim()) || priceRe.test(lines[i])) {
      if (i > 0) keep.add(i - 1);
      keep.add(i);
      keep.add(i + 1);
    }
  }
  if (keep.size === 0) return md.slice(0, MENU_INPUT_CHARS);
  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => lines[i] ?? "")
    .join("\n")
    .slice(0, MENU_INPUT_CHARS);
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * URLs http/https públicas (defensa en profundidad anti-SSRF + filtra basura/internas).
 * Acepta http porque Google Places devuelve MUCHAS webs de restaurante como `http://`
 * (Goiko, etc.); Crawl4AI/Playwright sigue el redirect a https si lo hay. Mantiene el
 * bloqueo de hosts internos (localhost, .local, rangos privados).
 */
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

/**
 * Resuelve de dónde sacar el menú: (1) plataforma de delivery (menús estructurados);
 * (2) web propia del restaurante vía Google `websiteUri` — preferimos una página de su
 * dominio que aparezca en la búsqueda (suele ser /carta) y, si no, la home. null = nada
 * scrapeable.
 */
async function resolveMenuUrl(opts: { name: string; city: string; googlePlaceId: string | null }): Promise<string | null> {
  // 1. Web propia del restaurante (Google websiteUri): fuente principal y RÁPIDA.
  //    Si la hay, la usamos directamente — sin gastar una búsqueda en Firecrawl (que
  //    además suele devolver homónimos de otra ciudad). Crawl4AI la renderiza.
  const website = opts.googlePlaceId ? await placeWebsite(opts.googlePlaceId).catch(() => null) : null;
  if (website && isSafeWebUrl(website)) return website;
  // 2. Sin web propia: buscar con Firecrawl (plataforma de delivery o mejor resultado https).
  if (!hasFirecrawlKey()) return null;
  const results = (await firecrawlSearch(`${opts.name} ${opts.city} carta menú`, 10).catch(() => [])).filter((r) =>
    isSafeWebUrl(r.url),
  );
  for (const domain of DELIVERY_DOMAINS) {
    const hit = results.find((r) => hostOf(r.url)?.includes(domain));
    if (hit) return hit.url;
  }
  return results[0]?.url ?? null;
}

/** Estructura el markdown de una página en categorías de menú (vacío si no hay carta). */
async function extractFromMarkdown(markdown: string | null): Promise<NormCat[]> {
  if (!markdown) return [];
  const focused = condenseMenuMarkdown(markdown);
  const t = Date.now();
  const extracted = await extractJson<ExtractedMenu>(focused, MENU_SCHEMA, MENU_PROMPT, { timeoutMs: 60000 });
  console.log(`[food-menu]   llm=${Date.now() - t}ms chars=${focused.length}`);
  return normalizeMenu(extracted);
}

// Enlaces que suelen llevar a la carta/pedidos (muchas webs no traen el menú en la home).
const MENU_TEXT_RE = /\b(cartas?|men[uú]s?|pedir|pedidos?|a\s*domicilio|haz\s*tu\s*pedido|comida|delivery|takeaway)\b/i;
const MENU_HREF_RE = /(carta|menu|pedir|pedido|comida|delivery|takeaway|order|online|food|productos|tienda)/i;
const SKIP_HREF_RE = /\.(pdf|jpe?g|png|webp|gif|svg|mp4|zip|docx?)(\?|#|$)/i;

function baseDomain(host: string): string {
  return host.split(".").slice(-2).join(".");
}
function sameSite(a: string | null, b: string | null): boolean {
  return Boolean(a && b && (a === b || baseDomain(a) === baseDomain(b)));
}

/**
 * De los enlaces internos de una página, elige el que más probablemente lleva a la
 * carta/pedidos (mismo sitio, https seguro, no la propia página, no PDF/imagen). null
 * si ninguno parece de menú. Puntúa el texto del enlace y la ruta; "carta"/"menú" pesan más.
 */
function pickMenuLink(links: Crawl4aiLink[], pageUrl: string): string | null {
  const pageHost = hostOf(pageUrl);
  let pagePath = "/";
  try {
    pagePath = new URL(pageUrl).pathname.replace(/\/+$/, "") || "/";
  } catch {
    /* noop */
  }
  let best: { url: string; score: number; len: number } | null = null;
  for (const l of links) {
    if (!l.href || /^(#|mailto:|tel:|javascript:)/i.test(l.href)) continue;
    let abs: URL;
    try {
      abs = new URL(l.href, pageUrl);
    } catch {
      continue;
    }
    if (SKIP_HREF_RE.test(abs.pathname)) continue;
    const host = abs.hostname.toLowerCase().replace(/^www\./, "");
    if (!sameSite(pageHost, host)) continue;
    const path = abs.pathname.replace(/\/+$/, "") || "/";
    if (path === pagePath) continue; // la propia home/página actual
    const candidate = abs.toString();
    if (!isSafeWebUrl(candidate)) continue;
    const decoded = decodeURIComponent(abs.pathname);
    let score = 0;
    if (MENU_TEXT_RE.test(l.text)) score += 3;
    if (MENU_HREF_RE.test(decoded)) score += 2;
    if (/\b(carta|men[uú])\b/i.test(l.text) || /(carta|menu)/i.test(decoded)) score += 2; // explícito > genérico
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && candidate.length < best.len)) {
      best = { url: candidate, score, len: candidate.length };
    }
  }
  return best?.url ?? null;
}

/**
 * Busca la URL del restaurante en una plataforma de delivery con actor de Apify
 * (Glovo / Just Eat) vía Firecrawl search. Devuelve plataforma + URL del primer
 * resultado de un dominio soportado. null si no hay (o sin Firecrawl para buscar).
 */
async function findDeliveryUrl(name: string, city: string): Promise<{ platform: DeliveryPlatform; url: string } | null> {
  if (!hasFirecrawlKey()) return null;
  // Solo Glovo: en pruebas el actor de Just Eat devolvió 0 items (incl. el ejemplo UK de
  // su doc → roto). Preferimos la URL de TIENDA (/stores/...), no las páginas de marca
  // (/glovo-delivery/...), que no dan menú.
  const results = (await firecrawlSearch(`${name} ${city} glovo`, 10).catch(() => [])).filter((r) => isSafeWebUrl(r.url));
  const store = results
    .map((r) => r.url)
    .find((u) => hostOf(u)?.includes("glovoapp.com") && u.includes("/stores/"));
  return store ? { platform: "glovo", url: store } : null;
}

/**
 * Extrae la carta de `url` con la cascada:
 *   (1) Crawl4AI (markdown gratis) + LLM, siguiendo el enlace a la carta si la home no
 *       la trae — ideal para restaurantes con web propia sencilla.
 *   (1.5) Apify (Glovo): menú YA estructurado, sin LLM — para cadenas cuya web propia es
 *       app-JS sin menú en el HTML (KFC, Goiko...). Requiere Firecrawl para hallar la URL
 *       de tienda. (Just Eat se probó y su actor está roto; queda fuera.)
 *   (2) Firecrawl como respaldo de pago (scrape+extract, cubre DataDome).
 * Devuelve las categorías normalizadas y la URL que de verdad dio la carta (para
 * cachearla y ahorrarse el salto en refrescos). `ctx` aporta name/city para el tier Apify.
 */
async function extractMenu(
  url: string,
  ctx: { name?: string; city?: string } = {},
): Promise<{ categories: NormCat[]; usedUrl: string }> {
  // Tier 1 (gratis): Crawl4AI renderiza+limpia en el VPS, el LLM estructura el menú.
  if (hasCrawl4aiConfig() && hasLlmExtractor()) {
    try {
      const tc = Date.now();
      const home = await crawl4aiCrawl(url, { timeoutMs: 30000 });
      console.log(`[food-menu]   crawl(home)=${Date.now() - tc}ms`);
      const fromHome = await extractFromMarkdown(home.markdown);
      if (fromHome.length) return { categories: fromHome, usedUrl: url };
      // La home no trae carta → sigue el mejor enlace a la carta/pedidos (un salto).
      const menuUrl = pickMenuLink(home.links, url);
      if (menuUrl) {
        const tm = Date.now();
        const md = await crawl4aiMarkdown(menuUrl, { timeoutMs: 30000 });
        console.log(`[food-menu]   crawl(carta)=${Date.now() - tm}ms ${menuUrl}`);
        const fromMenu = await extractFromMarkdown(md);
        if (fromMenu.length) return { categories: fromMenu, usedUrl: menuUrl };
      }
    } catch (e) {
      console.error("[food-menu] Crawl4AI/LLM falló, probando siguiente tier:", e instanceof Error ? e.message : e);
    }
  }

  // Tier 1.5 (Apify): plataforma de delivery con menú estructurado (sin LLM). Para
  // cadenas/sitios donde la web propia dio carta vacía. Más barato y fiable que el
  // respaldo de Firecrawl para esos casos.
  if (hasApifyMenu() && ctx.name && hasFirecrawlKey()) {
    try {
      const delivery = await findDeliveryUrl(ctx.name, ctx.city ?? "");
      if (delivery) {
        const extracted = await apifyMenuFromDeliveryUrl(delivery.platform, delivery.url, ctx.city ?? "");
        const cats = normalizeMenu(extracted);
        if (cats.length) return { categories: cats, usedUrl: delivery.url };
      }
    } catch (e) {
      console.error("[food-menu] Apify falló, probando Firecrawl:", e instanceof Error ? e.message : e);
    }
  }

  // Tier 2 (respaldo de pago): Firecrawl hace scrape + extracción con schema en una llamada.
  if (hasFirecrawlKey()) {
    const extracted = await firecrawlScrapeJson<ExtractedMenu>(url, MENU_SCHEMA, {
      prompt: MENU_PROMPT,
      timeoutMs: 45000,
      maxAge: MENU_TTL_MS, // reusa la caché de Firecrawl en refrescos de la misma URL
    });
    return { categories: normalizeMenu(extracted), usedUrl: url };
  }
  return { categories: [], usedUrl: url };
}

// Un FETCHING más viejo que esto se considera un lock muerto (lambda reciclado) y se
// puede reclamar. Cubre con holgura el peor caso de scrape (~180 s).
const STALE_FETCH_LOCK_MS = 5 * 60 * 1000;
// Tras N fallos consecutivos, FAILED (terminal): no re-encolar en auto (webs no-scrapeables).
const MAX_MENU_ATTEMPTS = 3;

type TerminalStatus = "READY" | "EMPTY" | "FAILED";

/**
 * Resuelve URL → extrae carta → guarda en BBDD. Devuelve READY (con items) o EMPTY
 * (sin carta). NO toca menuStatus (eso lo hace processMenu). Emite tiempos por paso.
 */
async function scrapeAndStore(r: {
  id: string;
  name: string;
  city: string;
  menuSourceUrl: string | null;
  googlePlaceId: string | null;
}): Promise<{ status: "READY" | "EMPTY"; items: number }> {
  const t0 = Date.now();
  const url = r.menuSourceUrl ?? (await resolveMenuUrl({ name: r.name, city: r.city, googlePlaceId: r.googlePlaceId }));
  const tResolve = Date.now() - t0;
  if (!url) {
    console.log(`[food-menu] ${r.id} resolveUrl=${tResolve}ms → sin URL ("${r.name}", ${r.city})`);
    return { status: "EMPTY", items: 0 };
  }

  const te = Date.now();
  const { categories, usedUrl } = await extractMenu(url, { name: r.name, city: r.city });
  const tExtract = Date.now() - te;
  if (categories.length === 0) {
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuSourceUrl: url } }).catch(() => {});
    console.log(`[food-menu] ${r.id} resolveUrl=${tResolve}ms extract=${tExtract}ms → carta vacía ("${r.name}")`);
    return { status: "EMPTY", items: 0 };
  }

  await prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany({ where: { restaurantId: r.id } });
    await tx.menuCategory.deleteMany({ where: { restaurantId: r.id } });
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
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
    await tx.restaurant.update({ where: { id: r.id }, data: { menuSourceUrl: usedUrl } });
  });
  const items = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(
    `[food-menu] ${r.id} resolveUrl=${tResolve}ms extract=${tExtract}ms → READY ${categories.length} cats / ${items} platos ("${r.name}")`,
  );
  return { status: "READY", items };
}

/**
 * Procesa UN restaurante de la cola. Claim ATÓMICO (PENDING→FETCHING, o reclama un
 * FETCHING colgado): updateMany con guard = exclusión mutua a nivel de fila en Postgres,
 * funciona ENTRE INSTANCIAS (a diferencia del antiguo Set en memoria). Devuelve el estado
 * terminal, o null si no pudo hacer claim (otro worker lo tiene). Seguro de llamar desde
 * el cron Y desde un after() fast-path: el lock evita scrapes duplicados.
 */
export async function processMenu(restaurantId: string): Promise<TerminalStatus | null> {
  const staleBefore = new Date(Date.now() - STALE_FETCH_LOCK_MS);
  const claim = await prisma.restaurant.updateMany({
    where: {
      id: restaurantId,
      source: "google",
      OR: [
        { menuStatus: "PENDING" },
        { menuStatus: "FETCHING", menuQueuedAt: { lt: staleBefore } }, // lock muerto → reclamable
      ],
    },
    data: { menuStatus: "FETCHING", menuQueuedAt: new Date() },
  });
  if (claim.count === 0) return null; // otro lo tiene, o no procede

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, city: true, menuSourceUrl: true, source: true, googlePlaceId: true, menuAttempts: true },
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
    // Agotó intentos → FAILED (terminal). Si no, vuelve a PENDING para reintento del cron.
    const next: "FAILED" | "PENDING" = attempts >= MAX_MENU_ATTEMPTS ? "FAILED" : "PENDING";
    await prisma.restaurant
      .update({ where: { id: r.id }, data: { menuStatus: next, menuFetchedAt: new Date(), menuAttempts: attempts } })
      .catch(() => {});
    return next === "FAILED" ? "FAILED" : null;
  }
}

/**
 * Estado del menú para la respuesta de la ficha (contrato del móvil), SIN efectos.
 * El encolado lo hace `enqueueMenu` por separado. Stale-while-revalidate: si hay carta
 * cacheada se muestra ("ready") aunque esté stale; el refresco va por detrás.
 */
export function menuStatusFor(r: {
  source: string | null;
  menuStatus: string | null;
  hasMenu: boolean;
}): MenuStatus {
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
 * El scrape real lo hace el worker (cron) o el fast-path after().
 */
export async function enqueueMenu(r: {
  id: string;
  source: string | null;
  menuStatus: string | null;
  menuFetchedAt: Date | null;
  hasMenu: boolean;
}): Promise<boolean> {
  if (r.source !== "google" || !canScrapeMenus()) return false;
  if (r.menuStatus === "PENDING" || r.menuStatus === "FETCHING") return false; // ya en cola/proceso
  const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
  if (fresh) return false; // carta (o intento terminal) fresca → no re-scrapear todavía
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
 * carta fresca, priorizando cocinas de delivery. NO scrapea — eso lo hace el worker
 * (cron). Barato: un solo updateMany. Devuelve los ids encolados.
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
 * FETCHING colgados, en orden de antigüedad) y los procesa SECUENCIALMENTE (respeta el
 * rate-limit por minuto del LLM). Cada uno via processMenu (claim atómico → sin duplicados).
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
