import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { avatarUrl } from "@/lib/chat/serialize";
import { normalizeUsername, usernameError } from "@nidokey/shared";

/** En BBDD `image` es una key de R2; hacia el cliente siempre va como URL. */
function profileDto(user: { id: string; email: string; name: string | null; username: string | null; image: string | null }) {
  return { ...user, image: avatarUrl(user) };
}

/** GET /api/account — mi perfil (incluye username y email). */
export async function GET() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, username: true, image: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profileDto(user));
}

const PatchInput = z.object({
  name: z.string().trim().min(1).max(60).optional().nullable(),
  username: z.string().optional().nullable(),
  /** Key de R2 devuelta por POST /api/account/avatar; null = quitar foto. */
  image: z.string().max(300).optional().nullable(),
});

/**
 * PATCH /api/account — actualizar nombre visible y/o @username. El alias se
 * normaliza y valida (formato + reservados); unicidad en BBDD (409 si tomado).
 */
export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: { name?: string | null; username?: string | null; image?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;

  if (parsed.data.image !== undefined) {
    if (parsed.data.image === null || parsed.data.image === "") {
      data.image = null; // quitar foto (vuelve a iniciales)
    } else if (parsed.data.image.startsWith(`avatars/${userId}/`)) {
      data.image = parsed.data.image; // solo keys PROPIAS (presignadas por /avatar)
    } else {
      return NextResponse.json({ error: "Imagen no válida" }, { status: 400 });
    }
  }

  if (parsed.data.username !== undefined) {
    if (parsed.data.username === null || parsed.data.username === "") {
      data.username = null; // quitar alias
    } else {
      const err = usernameError(parsed.data.username);
      if (err) return NextResponse.json({ error: "username_" + err }, { status: 400 });
      data.username = normalizeUsername(parsed.data.username);
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, username: true, image: true },
    });
    return NextResponse.json(profileDto(user));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    throw e;
  }
}
