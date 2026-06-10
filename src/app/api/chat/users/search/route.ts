import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_LIMITS } from "@/lib/chat/config";
import { userDto } from "@/lib/chat/serialize";

/**
 * GET /api/chat/users/search?q= — buscar usuarios para iniciar un chat.
 * Mínimo 3 caracteres (no se puede enumerar el directorio), por email o nombre,
 * excluyéndome. Devuelve una proyección mínima.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, image: true },
    take: CHAT_LIMITS.userSearchLimit,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users: users.map(userDto) });
}
