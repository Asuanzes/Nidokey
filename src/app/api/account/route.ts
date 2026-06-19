import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { avatarUrl } from "@/lib/chat/serialize";
import { deleteObject } from "@/lib/chat/r2";
import { isProtectedName, normalizeUsername, usernameError } from "@nidokey/shared";

/** En BBDD `image` es una key de R2; hacia el cliente siempre va como URL. */
function profileDto(user: {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  image: string | null;
  onboardingCompletedAt: Date | null;
}) {
  return { ...user, image: avatarUrl(user) };
}

/** GET /api/account — mi perfil (incluye username y email). */
export async function GET() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, username: true, image: true, onboardingCompletedAt: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profileDto(user));
}

const PatchInput = z.object({
  name: z.string().trim().min(1).max(60).optional().nullable(),
  username: z.string().optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
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

  const data: {
    name?: string | null;
    username?: string | null;
    image?: string | null;
    onboardingCompletedAt?: Date;
  } = {};
  if (parsed.data.name !== undefined) {
    // El @alias ya filtra reservados; el nombre visible es texto libre → mismo
    // filtro anti-suplantación (que nadie se ponga "NIDOKEY" et al.).
    if (parsed.data.name && isProtectedName(parsed.data.name)) {
      return NextResponse.json({ error: "name_reserved" }, { status: 400 });
    }
    data.name = parsed.data.name;
  }
  if (parsed.data.onboardingCompleted === true) data.onboardingCompletedAt = new Date();

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

  // Si se cambia/quita la foto, el avatar ANTERIOR se borra de R2 tras
  // responder (after, fire-and-forget) — si no, cada cambio dejaba un objeto
  // huérfano para siempre (el cron de limpieza es solo la red de seguridad).
  let oldImage: string | null = null;
  if (data.image !== undefined) {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
    oldImage = current?.image ?? null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, username: true, image: true, onboardingCompletedAt: true },
    });
    if (oldImage && oldImage.startsWith(`avatars/${userId}/`) && oldImage !== user.image) {
      const stale = oldImage;
      after(async () => {
        const ok = await deleteObject(stale);
        if (!ok) console.error(`[account] no se pudo borrar el avatar anterior de R2: ${stale}`);
      });
    }
    return NextResponse.json(profileDto(user));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    throw e;
  }
}
