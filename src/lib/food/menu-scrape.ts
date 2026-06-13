import { prisma } from "@/lib/db";
import { firecrawlScrapeJson, firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";
import { placeWebsite } from "@/features/sources/providers/google-places";
import { crawl4aiMarkdown, hasCrawl4aiConfig } from "@/features/sources/providers/crawl4ai";
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

/** Solo URLs https públicas (defensa en profundidad anti-SSRF + filtra basura/internas). */
function isSafeHttpsUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
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
  // La búsqueda web solo está disponible con Firecrawl (encuentra plataformas de
  // delivery o la página /carta del propio dominio). Sin clave, vamos directos a la
  // web del restaurante que da Google → Crawl4AI la renderiza gratis.
  const results = hasFirecrawlKey()
    ? (await firecrawlSearch(`${opts.name} ${opts.city} carta menú`, 10).catch(() => [])).filter((r) => isSafeHttpsUrl(r.url))
    : [];
  // 1. Delivery (menús estructurados; el scrape de estos lo cubre solo Firecrawl por DataDome).
  for (const domain of DELIVERY_DOMAINS) {
    const hit = results.find((r) => hostOf(r.url)?.includes(domain));
    if (hit) return hit.url;
  }
  // 2. Web propia del restaurante (Google websiteUri) — fuente GRATIS principal (Crawl4AI).
  const website = opts.googlePlaceId ? await placeWebsite(opts.googlePlaceId).catch(() => null) : null;
  if (website && isSafeHttpsUrl(website)) {
    const siteHost = hostOf(website);
    if (siteHost) {
      // Prefiere una página de su dominio que la búsqueda asocie a la carta (suele ser /carta).
      const onSite = results.find((r) => hostOf(r.url)?.includes(siteHost));
      if (onSite) return onSite.url;
    }
    return website;
  }
  // 3. Sin web propia: el mejor resultado https de la búsqueda, si lo hay.
  return results[0]?.url ?? null;
}

/**
 * Extrae la carta de `url` con la cascada: (1) Crawl4AI (markdown gratis) + Claude
 * (estructura el JSON) y (2) Firecrawl como respaldo (scrape+extract en una llamada,
 * cubre sitios con DataDome). Devuelve categorías normalizadas (puede ser []).
 */
async function extractMenu(url: string): Promise<NormCat[]> {
  // Tier 1 (gratis): Crawl4AI renderiza+limpia en el VPS, el LLM (Gemini) estructura el menú.
  if (hasCrawl4aiConfig() && hasLlmExtractor()) {
    try {
      const markdown = await crawl4aiMarkdown(url, { timeoutMs: 45000 });
      if (markdown) {
        const focused = condenseMenuMarkdown(markdown);
        const extracted = await extractJson<ExtractedMenu>(focused, MENU_SCHEMA, MENU_PROMPT, { timeoutMs: 60000 });
        const cats = normalizeMenu(extracted);
        if (cats.length) return cats;
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
    return normalizeMenu(extracted);
  }
  return [];
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

  const categories = await extractMenu(url);
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
    await tx.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date(), menuSourceUrl: url } });
  });
  const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`[food-menu] "${r.name}": ${categories.length} categorías, ${itemCount} platos desde ${url}`);
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
