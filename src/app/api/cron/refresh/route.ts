import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { isCronAuthorized } from "@/lib/cron-auth";
import { refreshType } from "@/features/sources/refresh";

/**
 * GET /api/cron/refresh?type=crypto
 *
 * Disparado por un scheduler externo GRATIS (cron-job.org cada 1-2 min para
 * cripto/mercados) que envía `Authorization: Bearer $CRON_SECRET`.
 *
 * maxDuration acorde a Vercel Hobby (~60 s): cripto/mercados son 1-2 llamadas
 * batch a la API, caben de sobra. Los tipos de scraping (property…) NO se
 * refrescan aquí, sino vía GitHub Actions (scripts/refresh-type.ts).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const type = (req.nextUrl.searchParams.get("type") ?? "crypto") as RecordType;
  try {
    const summary = await refreshType(type);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron-refresh] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
