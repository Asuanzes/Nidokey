import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { listTrends } from "@/features/trends/api";

export async function GET(req: NextRequest) {
  try {
    await requireUserId();
    const res = await listTrends(req.nextUrl.searchParams);
    return NextResponse.json(res.body, { status: res.status });
  } catch (e) {
    if (e instanceof Error && e.message === "No autenticado") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.error("[trends-api] list error:", e);
    return NextResponse.json({ error: "No se pudieron cargar tendencias", kind: "error" }, { status: 502 });
  }
}

