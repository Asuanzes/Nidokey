import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getTrend } from "@/features/trends/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requireUserId();
    const { id } = await params;
    const res = await getTrend(id);
    return NextResponse.json(res.body, { status: res.status });
  } catch (e) {
    if (e instanceof Error && e.message === "No autenticado") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.error("[trends-api] detail error:", e);
    return NextResponse.json({ error: "No se pudo cargar la tendencia", kind: "error" }, { status: 502 });
  }
}

