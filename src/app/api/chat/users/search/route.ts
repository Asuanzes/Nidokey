import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { normalizeUsername } from "@nidokey/shared";
import { userDto } from "@/lib/chat/serialize";

/**
 * GET /api/chat/users/search?q= — resuelve a UNA persona por dato EXACTO:
 * email completo o @username completo (case-insensitive). NO hay búsqueda
 * parcial ni por nombre → no se puede enumerar el directorio de usuarios.
 * Devuelve { users: [] } o un único usuario.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (raw.length < 3) return NextResponse.json({ users: [] });

  const isEmail = raw.includes("@") && raw.includes(".") && !raw.startsWith("@");
  const where = isEmail
    ? { email: { equals: raw, mode: "insensitive" as const } }
    : { username: normalizeUsername(raw) };

  const user = await prisma.user.findFirst({
    where: { ...where, id: { not: userId } },
    select: { id: true, name: true, username: true, email: true, image: true },
  });

  return NextResponse.json({ users: user ? [userDto(user)] : [] });
}
