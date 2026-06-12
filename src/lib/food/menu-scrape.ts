import { prisma } from "@/lib/db";
import { firecrawlScrapeJson, firecrawlSearch, hasFirecrawlKey } from "@/features/sources/providers/firecrawl";

/**
 * Menús reales por scraping (Firecrawl). Solo para restaurantes descubiertos por
 * Google (`source === "google"`); los del seed conservan su menú manual. La carta
 * se cachea en MenuCategory/MenuItem con TTL (Restaurant.menuFetchedAt); se refresca
 * on-demand al abrir la ficha. El scraping corre en background (after()), nunca
 * bloquea la respuesta: la ficha abre al instante con menuStatus="fetching" y el
 * móvil hace polling hasta "ready"/"unavailable".
 */

export type MenuStatus = "ready" | "fetching" | "unavailable" | "empty";

const MENU_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_CATEGORIES = 40;
const MAX_ITEMS = 80;
// Plataformas de delivery en España, por orden de preferencia.
const DELIVERY_DOMAINS = ["glovoapp.com", "just-eat.es", "justeat.es", "ubereats.com"];

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

async function resolveDeliveryUrl(name: string, city: string): Promise<string | null> {
  const results = await firecrawlSearch(`${name} ${city} carta a domicilio`, 8);
  for (const domain of DELIVERY_DOMAINS) {
    const hit = results.find((r) => {
      try {
        return new URL(r.url).hostname.toLowerCase().includes(domain);
      } catch {
        return false;
      }
    });
    if (hit) return hit.url;
  }
  return null;
}

async function scrapeAndStoreMenu(restaurantId: string): Promise<void> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, city: true, menuSourceUrl: true, source: true },
  });
  if (!r || r.source !== "google") return;

  const url = r.menuSourceUrl ?? (await resolveDeliveryUrl(r.name, r.city));
  if (!url) {
    // No encontramos plataforma: marcamos intento para no re-buscar en cada apertura (TTL).
    await prisma.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: new Date() } });
    console.log(`[food-menu] sin URL de delivery para "${r.name}" (${r.city})`);
    return;
  }

  const extracted = await firecrawlScrapeJson<ExtractedMenu>(url, MENU_SCHEMA, {
    prompt: MENU_PROMPT,
    timeoutMs: 45000,
    maxAge: MENU_TTL_MS, // reusa la caché de Firecrawl en refrescos de la misma URL
  });
  const categories = normalizeMenu(extracted);
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
  if (!isGoogle || !hasFirecrawlKey()) {
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
      // Transitorio (anti-bot, timeout): no marcamos menuFetchedAt → se reintenta al reabrir.
      console.error("[food-menu] scrape falló:", e instanceof Error ? e.message : e);
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
export async function prewarmMenus(
  restaurants: { id: string; source: string | null; menuFetchedAt: Date | null }[],
  limit = 4,
): Promise<void> {
  if (!hasFirecrawlKey()) return;
  const targets: string[] = [];
  for (const r of restaurants) {
    if (targets.length >= limit) break;
    if (r.source !== "google") continue;
    const fresh = r.menuFetchedAt != null && Date.now() - r.menuFetchedAt.getTime() < MENU_TTL_MS;
    if (fresh || inFlight.has(r.id)) continue;
    inFlight.add(r.id);
    targets.push(r.id);
  }
  if (targets.length === 0) return;
  console.log(`[food-menu] prewarm: ${targets.length} restaurantes`);
  await Promise.allSettled(
    targets.map(async (id) => {
      try {
        await scrapeAndStoreMenu(id);
      } catch (e) {
        console.error("[food-menu] prewarm falló:", e instanceof Error ? e.message : e);
      } finally {
        inFlight.delete(id);
      }
    }),
  );
}
