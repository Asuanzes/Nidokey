import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { isCronAuthorized } from "@/lib/cron-auth";
import { refreshType } from "@/features/sources/refresh";

/**
 * GET /api/cron/refresh?type=crypto   (o ?type=market, o ?type=all)
 *
 * Disparado por un scheduler externo GRATIS (cron-job.org cada 1-2 min para
 * cripto/mercados) que envía `Authorization: Bearer $CRON_SECRET`.
 *
 * `?type=all` refresca cripto Y bolsa en una sola llamada → basta UN job de
 * cron-job.org (más cómodo y un ping menos a Neon). Ambos son llamadas batch a
 * sus APIs, caben de sobra en los ~60 s de Vercel Hobby. Los tipos de scraping
 * (property…) NO se refrescan aquí, sino vía GitHub Actions.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const type = req.nextUrl.searchParams.get("type") ?? "crypto";
  try {
    if (type === "all") {
      const [crypto, market] = await Promise.all([
        refreshType("crypto"),
        refreshType("market"),
      ]);
      return NextResponse.json({ crypto, market });
    }
    const summary = await refreshType(type as RecordType);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron-refresh] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
