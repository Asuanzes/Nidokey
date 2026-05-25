import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { issueMobileJwt } from "@/lib/mobile-jwt";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const Body = z.object({
  email: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/, "Código debe ser 6 dígitos"),
});

/**
 * POST /api/auth/mobile/verify
 * Body: { email, code }
 *
 * Verifica el OTP. Si es correcto:
 *  - Consume el código (delete).
 *  - Marca `emailVerified`.
 *  - Devuelve JWT (Authorization: Bearer ...) + datos del usuario.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const code = parsed.data.code;

  const vt = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `mobile:${code}` },
  });
  if (!vt) {
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401, headers: CORS_HEADERS });
  }
  if (vt.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token: vt.token } },
    });
    return NextResponse.json({ error: "Código caducado" }, { status: 401, headers: CORS_HEADERS });
  }

  // Consumir el código (one-time use)
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token: vt.token } },
  });

  // Marcar email como verificado
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, emailVerified: new Date() },
    update: { emailVerified: new Date() },
  });

  const token = await issueMobileJwt(user.id, user.email);
  return NextResponse.json(
    { token, user: { id: user.id, email: user.email, name: user.name } },
    { headers: CORS_HEADERS }
  );
}
