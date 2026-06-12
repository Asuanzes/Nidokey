import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { menuPlan } from "@/lib/food/menu-scrape";

export const maxDuration = 60;

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
  const plan = menuPlan({
    id: restaurant.id,
    source: restaurant.source,
    menuFetchedAt: restaurant.menuFetchedAt,
    hasMenu,
  });
  if (plan.scrape) after(plan.scrape); // fire-and-forget; no bloquea la respuesta

  return NextResponse.json({ restaurant, menuStatus: plan.status });
}
