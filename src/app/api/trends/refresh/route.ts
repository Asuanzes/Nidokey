import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { refreshTrends } from "@/features/trends/refresh";

export const maxDuration = 60;

/**
 * Force-refresh de tendencias disparado por el usuario (pull-to-refresh real).
 *
 * El GET /api/trends es solo lectura; sin esto, tirar para refrescar solo
 * re-lee la BD. Aquí re-escrapeamos las fuentes, pero con un COOLDOWN GLOBAL
 * (no por usuario, para no necesitar Redis): si la tendencia más reciente se
 * refrescó hace menos de COOLDOWN_MS, devolvemos sin re-escrapear. El cron
 * (cada 30 min) sigue siendo la vía principal; esto es un empujón puntual.
 */
const COOLDOWN_MS = 5 * 60 * 1000;

export async function POST() {
  try {
    await requireUserId();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const latest = await prisma.trend.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });
  if (latest) {
    const elapsed = Date.now() - latest.lastSeenAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      return NextResponse.json({
        refreshed: false,
        reason: "cooldown",
        retryInSec: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
      });
    }
  }

  try {
    const summary = await refreshTrends();
    return NextResponse.json({ refreshed: true, summary });
  } catch (e) {
    console.error("[trends-refresh] user error:", e);
    return NextResponse.json({ error: "No se pudieron refrescar tendencias" }, { status: 502 });
  }
}
