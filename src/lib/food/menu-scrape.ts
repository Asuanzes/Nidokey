import { prisma } from "@/lib/db";
import { firecrawlScrapeJson, firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";
import { placeWebsite } from "@/features/sources/providers/google-places";
import { crawl4aiCrawl, crawl4aiMarkdown, hasCrawl4aiConfig, type Crawl4aiLink } from "@/features/sources/providers/crawl4ai";
import { extractJson, hasLlmExtractor } from "@/features/sources/providers/llm-extract";

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
 * ¿Podemos scrapear menús? Con Crawl4AI+Claude (gratis, web propia del restaurante)
 * o con Firecrawl (respaldo de pago, cubre delivery con DataDome). Si no hay ninguno,
 * las cartas de Google quedan como "no disponible".
 */
function canScrapeMenus(): boolean {
  return hasFirecrawlKey() || (hasCrawl4aiConfig() && hasLlmExtractor());
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
  const extracted = await extractJson<ExtractedMenu>(focused, MENU_SCHEMA, MENU_PROMPT, { timeoutMs: 60000 });
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
 * Extrae la carta de `url` con la cascada: (1) Crawl4AI (markdown gratis) + LLM
 * (estructura el JSON), siguiendo el enlace a la carta si la home no la trae, y
 * (2) Firecrawl como respaldo (scrape+extract, cubre sitios con DataDome). Devuelve
 * las categorías normalizadas y la URL que de verdad dio la carta (para cachearla y
 * ahorrarse el salto desde la home en refrescos).
 */
async function extractMenu(url: string): Promise<{ categories: NormCat[]; usedUrl: string }> {
  // Tier 1 (gratis): Crawl4AI renderiza+limpia en el VPS, el LLM estructura el menú.
  if (hasCrawl4aiConfig() && hasLlmExtractor()) {
    try {
      const home = await crawl4aiCrawl(url, { timeoutMs: 30000 });
      const fromHome = await extractFromMarkdown(home.markdown);
      if (fromHome.length) return { categories: fromHome, usedUrl: url };
      // La home no trae carta → sigue el mejor enlace a la carta/pedidos (un salto).
      const menuUrl = pickMenuLink(home.links, url);
      if (menuUrl) {
        const md = await crawl4aiMarkdown(menuUrl, { timeoutMs: 30000 });
        const fromMenu = await extractFromMarkdown(md);
        if (fromMenu.length) return { categories: fromMenu, usedUrl: menuUrl };
      }
    } catch (e) {
      console.error("[food-menu] Crawl4AI/LLM falló, probando Firecrawl:", e instanceof Error ? e.message : e);
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

async function scrapeAndStoreMenu(restaurantId: string): Promise<void> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, city: true, menuSourceUrl: true, source: true, googlePlaceId: true },
  });
  if (!r || r.source !== "google") return;

  const url = r.menuSourceUrl ?? (await resolveMenuUrl({ name: r.name, city: r.city, googlePlaceId: r.googlePlaceId }));
  if (!url) {
    // No encontramos plataforma: marcamos intento para no re-buscar en cada apertura (TTL).
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date() } });
    console.log(`[food-menu] sin URL de delivery para "${r.name}" (${r.city})`);
    return;
  }

  const { categories, usedUrl } = await extractMenu(url);
  if (categories.length === 0) {
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date(), menuSourceUrl: url } });
    console.log(`[food-menu] carta vacía para "${r.name}" desde ${url}`);
    return;
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
    await tx.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date(), menuSourceUrl: usedUrl } });
  });
  const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[food-menu] "${r.name}": ${categories.length} categorías, ${itemCount} platos desde ${usedUrl}`);
}

// Dedup best-effort de scrapes concurrentes dentro de una misma instancia.
const inFlight = new Set<string>();

/**
 * Decide el estado del menú para la ficha y, si toca, devuelve un thunk para
 * scrapear en background (via after()). No lanza: degrada con elegancia.
 */
export function menuPlan(r: {
  id: string;
  source: string | null;
  menuFetchedAt: Date | null;
  hasMenu: boolean;
}): { status: MenuStatus; scrape?: () => Promise<void> } {
  const isGoogle = r.source === "google";
  if (!isGoogle || !canScrapeMenus()) {
    return { status: r.hasMenu ? "ready" : "empty" };
  }
  const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
  if (fresh) {
    return { status: r.hasMenu ? "ready" : "unavailable" };
  }
  // Stale o nunca scrapeado: refrescar en background (stale-while-revalidate).
  if (inFlight.has(r.id)) {
    return { status: r.hasMenu ? "ready" : "fetching" };
  }
  inFlight.add(r.id);
  const scrape = async () => {
    try {
      await scrapeAndStoreMenu(r.id);
    } catch (e) {
      // Marcar intento para NO quedarse en "cargando" infinito si el scrape falla.
      console.error("[food-menu] scrape falló, marcando intento:", e instanceof Error ? e.message : e);
      await prisma.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date() } }).catch(() => {});
    } finally {
      inFlight.delete(r.id);
    }
  };
  return { status: r.hasMenu ? "ready" : "fetching", scrape };
}

/**
 * Pre-calienta (scrapea en background) los menús de los `limit` primeros restaurantes
 * de Google sin carta fresca, para que al abrirlos ya estén cacheados. Best-effort;
 * dedup por TTL + inFlight (no re-scrapea los ya frescos/en vuelo). Pensado para
 * llamarse desde `after()` en el descubrimiento.
 */
// Tipos de Google Places (cocinas) que más se piden a domicilio → se pre-calientan primero.
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

export async function prewarmMenus(
  restaurants: { id: string; source: string | null; menuFetchedAt: Date | null; types?: string[] }[],
  limit = 6,
): Promise<void> {
  if (!canScrapeMenus()) return;
  // Candidatos que necesitan scrape (Google + sin carta fresca + no en vuelo), en orden de distancia.
  const candidates = restaurants.filter((r) => {
    if (r.source !== "google") return false;
    const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
    return !fresh && !inFlight.has(r.id);
  });
  // Prioriza cocinas que más se piden a domicilio, conservando el orden de distancia dentro de cada grupo.
  const popular = candidates.filter((r) => isPopularDelivery(r.types));
  const rest = candidates.filter((r) => !isPopularDelivery(r.types));
  const targets = [...popular, ...rest].slice(0, limit).map((r) => r.id);
  if (targets.length === 0) return;
  for (const id of targets) inFlight.add(id);
  console.log(`[food-menu] prewarm: ${targets.length} restaurantes (secuencial, populares primero)`);
  // Secuencial (no en paralelo) para no saturar el límite por minuto del LLM gratis.
  for (const id of targets) {
    try {
      await scrapeAndStoreMenu(id);
    } catch (e) {
      console.error("[food-menu] prewarm falló, marcando intento:", e instanceof Error ? e.message : e);
      await prisma.restaurant.update({ where: { id }, data: { menuFetchedAt: new Date() } }).catch(() => {});
    } finally {
      inFlight.delete(id);
    }
  }
}
