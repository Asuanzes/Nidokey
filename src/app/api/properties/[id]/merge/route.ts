import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mergeProperties } from "@/features/matching/merge";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  intoId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "intoId requerido" }, { status: 400 });
  }
  try {
    const result = await mergeProperties(id, parsed.data.intoId);
    return NextResponse.json({ ok: true, ...result, targetId: parsed.data.intoId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
