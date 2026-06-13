import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export const maxDuration = 60;

/**
 * Refresco manual de la carta: invalida la caché (menuFetchedAt/menuSourceUrl) para
 * que el siguiente GET /api/food/restaurants/[id] la re-scrapee (vía menuPlan →
 * after()). Pensado para el botón "Actualizar carta" del móvil cuando el menú cambió
 * o salió "no disponible". Solo restaurantes de Google (el seed conserva su carta).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { id, active: true }, select: { id: true, source: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (r.source !== "google") return NextResponse.json({ error: "Este restaurante no se scrapea" }, { status: 400 });
  await prisma.restaurant.update({ where: { id: r.id }, data: { menuFetchedAt: null, menuSourceUrl: null } });
  return NextResponse.json({ ok: true });
}
