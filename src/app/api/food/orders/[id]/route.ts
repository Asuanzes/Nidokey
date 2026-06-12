import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getOrderForViewerOrNull } from "@/lib/food/guard";
import { foodOrderDto } from "@/lib/food/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const order = await getOrderForViewerOrNull(userId, id);
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ order: foodOrderDto(order) });
}
