import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { processMenu } from "@/lib/food/menu-scrape";

export const maxDuration = 300;

/**
 * Refresco manual de la carta ("Actualizar carta" / "Reintentar"): re-encola el menú
 * (menuStatus=PENDING) reseteando caché e intentos, y dispara el fast-path en background.
 * El siguiente GET devolverá "fetching" y el polling traerá la carta nueva. El cron es
 * la red de seguridad. Solo restaurantes de Google (el seed conserva su carta manual).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUserId();
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { id, active: true }, select: { id: true, source: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (r.source !== "google") return NextResponse.json({ error: "Este restaurante no se scrapea" }, { status: 400 });
  // Invalida caché + intentos y re-encola para forzar un re-scrape limpio.
  await prisma.restaurant.update({
    where: { id: r.id },
    data: { menuFetchedAt: null, menuSourceUrl: null, menuStatus: "PENDING", menuQueuedAt: new Date(), menuAttempts: 0 },
  });
  after(() => processMenu(r.id).catch(() => {})); // fast-path; cron como respaldo
  return NextResponse.json({ ok: true });
}
