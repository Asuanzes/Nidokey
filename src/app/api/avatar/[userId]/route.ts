import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signAttachmentUrl } from "@/lib/chat/r2";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * GET /api/avatar/[userId] — sirve la foto de perfil: 302 a la URL firmada de
 * R2 (bucket privado). PÚBLICO (allowlist del middleware): expo-image no envía
 * Authorization; los ids son cuids no enumerables y un avatar es contenido de
 * exposición mínima (modelo WhatsApp). Cacheable 1 h; el cliente versiona con
 * ?v=<basename de la key>, que cambia en cada actualización.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!user?.image) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }
  const url = await signAttachmentUrl(user.image); // key → firmada; http(s) legado → tal cual
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
