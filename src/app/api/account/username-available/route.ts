import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { normalizeUsername, usernameError } from "@nidokey/shared";

/**
 * GET /api/account/username-available?u=<alias> — ¿está libre y es válido?
 * Devuelve { ok, available, reason? }. El alias propio cuenta como disponible.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const raw = req.nextUrl.searchParams.get("u") ?? "";
  const err = usernameError(raw);
  if (err) return NextResponse.json({ ok: false, available: false, reason: err });

  const u = normalizeUsername(raw);
  const existing = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  const available = !existing || existing.id === userId;
  return NextResponse.json({ ok: true, available, reason: available ? null : "taken" });
}
