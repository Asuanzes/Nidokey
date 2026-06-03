import { NextRequest, NextResponse } from "next/server";
import { findSimilar } from "@/features/matching/find-similar";
import { requireUserId } from "@/lib/auth-helpers";
import { ensurePropertyOwner } from "@/lib/ownership";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const ownerId = await requireUserId();
  // El inmueble debe ser del usuario; si no, 404 (no filtramos existencia).
  if (!(await ensurePropertyOwner(id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const candidates = await findSimilar(id);
  return NextResponse.json({ candidates });
}
