import { NextRequest, NextResponse } from "next/server";
import { findSimilar } from "@/features/matching/find-similar";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const candidates = await findSimilar(id);
  return NextResponse.json({ candidates });
}
