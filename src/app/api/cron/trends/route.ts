import { NextRequest, NextResponse } from "next/server";
import type { TrendSource } from "@prisma/client";
import { isCronAuthorized } from "@/lib/cron-auth";
import { isTrendSource } from "@/features/trends/api";
import { refreshTrends } from "@/features/trends/refresh";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rawSource = req.nextUrl.searchParams.get("source") ?? "all";
  if (rawSource !== "all" && !isTrendSource(rawSource)) {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }

  try {
    const summary = await refreshTrends({ source: rawSource as TrendSource | "all" });
    return NextResponse.json(summary);
  } catch (e) {
    console.error("[trends-refresh] cron error:", e);
    return NextResponse.json({ error: "No se pudieron refrescar tendencias", kind: "error" }, { status: 502 });
  }
}

