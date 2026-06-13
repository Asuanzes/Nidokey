import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { runMenuQueue } from "@/lib/food/menu-scrape";

/**
 * GET /api/cron/food-menus[?limit=8]
 *
 * Worker DESACOPLADO de la cola de menús. Disparado por un scheduler externo
 * (GitHub Actions, ver .github/workflows/food-menus.yml) que envía
 * `Authorization: Bearer $CRON_SECRET`. Es el ÚNICO sitio donde corre el scraping
 * pesado (Crawl4AI/Firecrawl + LLM) garantizado fuera del camino del usuario.
 *
 * Reclama hasta `limit` restaurantes PENDING (o FETCHING colgados) con lock en BBDD y
 * los procesa secuencialmente. Es también la red de seguridad del fast-path after():
 * cualquier menú que un lambda de usuario no terminó acaba aquí.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 8;
  try {
    const summary = await runMenuQueue({ limit });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron-food-menus] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
