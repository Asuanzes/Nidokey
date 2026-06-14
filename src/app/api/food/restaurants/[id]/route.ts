import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { enqueueMenu, menuStatusFor, processMenu } from "@/lib/food/menu-scrape";

// La primera apertura de un restaurante sin carta ESPERA el scrape (await processMenu,
// ~20s con esqueleto). NO usamos after(): en Vercel se mata al cerrar la respuesta y el
// menú nunca llegaba (y dependía del cron, que es frágil). Al esperar, el lambda sigue
// vivo y la carta se devuelve ya poblada. Reaperturas = instantáneas (cacheado). 300s de
// presupuesto sobra para los ~20s del scrape.
export const maxDuration = 300;

const MENU_INCLUDE = {
  categories: {
    where: { active: true },
    orderBy: { sortOrder: "asc" as const },
    include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" as const } } },
  },
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  let restaurant = await prisma.restaurant.findFirst({ where: { id, active: true }, include: MENU_INCLUDE });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const hasMenu = restaurant.categories.some((c) => c.items.length > 0);

  // Encola si falta carta fresca y es cocina de delivery (solo restaurantes de Google).
  const enqueued = await enqueueMenu({
    id: restaurant.id,
    source: restaurant.source,
    menuStatus: restaurant.menuStatus,
    menuFetchedAt: restaurant.menuFetchedAt,
    hasMenu,
    cuisineTypes: restaurant.cuisineTypes,
  });

  if (enqueued) {
    // Scrape AHORA, esperándolo (no after). processMenu tiene lock en BBDD: si otra
    // instancia lo está haciendo, devuelve null y caemos al polling del móvil. Tras el
    // scrape, releemos para devolver la carta ya poblada en esta misma respuesta.
    await processMenu(restaurant.id).catch(() => {});
    const refreshed = await prisma.restaurant.findFirst({ where: { id, active: true }, include: MENU_INCLUDE });
    if (refreshed) restaurant = refreshed;
  }

  const hasMenuNow = restaurant.categories.some((c) => c.items.length > 0);
  const menuStatus = menuStatusFor({
    source: restaurant.source,
    menuStatus: restaurant.menuStatus,
    hasMenu: hasMenuNow,
    cuisineTypes: restaurant.cuisineTypes,
  });

  return NextResponse.json({ restaurant, menuStatus });
}
