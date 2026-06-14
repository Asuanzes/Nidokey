import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { enqueueMenu, menuStatusFor, processMenu } from "@/lib/food/menu-scrape";

// La RESPUESTA al usuario es siempre inmediata (lee BBDD + 1 UPDATE de encolado). El
// presupuesto largo es solo para el fast-path after() que intenta scrapear ya mismo;
// si se corta, el cron (/api/cron/food-menus) lo termina. El usuario nunca espera.
export const maxDuration = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { id, active: true },
    include: {
      categories: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: { items: { where: { available: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Menús reales por scraping (solo restaurantes de Google; el seed conserva el suyo).
  const hasMenu = restaurant.categories.some((c) => c.items.length > 0);

  // Encola si falta carta fresca y es cocina de delivery (barato: 1 UPDATE con guard).
  const enqueued = await enqueueMenu({
    id: restaurant.id,
    source: restaurant.source,
    menuStatus: restaurant.menuStatus,
    menuFetchedAt: restaurant.menuFetchedAt,
    hasMenu,
    cuisineTypes: restaurant.cuisineTypes,
  });
  // Fast-path: intenta procesarlo YA en background (lock en BBDD evita duplicar con el
  // cron). No bloquea la respuesta; si este lambda muere, el cron es la red de seguridad.
  if (enqueued) after(() => processMenu(restaurant.id).catch(() => {}));

  const menuStatus = menuStatusFor({
    source: restaurant.source,
    menuStatus: enqueued ? "PENDING" : restaurant.menuStatus,
    hasMenu,
    cuisineTypes: restaurant.cuisineTypes,
  });

  return NextResponse.json({ restaurant, menuStatus });
}
