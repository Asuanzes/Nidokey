import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

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
});

const RESEND_FROM = process.env.RESEND_FROM ?? "BuySell <onboarding@resend.dev>";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * POST /api/auth/mobile/request
 * Body: { email }
 *
 * Genera un código OTP de 6 dígitos y lo envía por email.
 * Crea el usuario si no existe (signup automático en primera petición).
 * Borra códigos previos para evitar acumular pendientes.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400, headers: CORS_HEADERS });
  }
  const email = parsed.data.email.trim().toLowerCase();

  await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  // Borra códigos anteriores de este email (solo el último vale)
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });

  const code = String(randomInt(100000, 1000000));
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: `mobile:${code}`,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
    },
  });

  const subject = "Tu código de acceso a BuySell";
  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;color:#3A5F8A;">BuySell Asturias</h2>
  <p>Tu código de acceso es:</p>
  <p style="margin:24px 0;font-size:32px;font-weight:600;letter-spacing:8px;color:#3A5F8A;font-family:monospace;text-align:center;">${code}</p>
  <p style="font-size:13px;color:#666;">Introdúcelo en la app. Caduca en 10 minutos.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="font-size:12px;color:#999;">Si no solicitaste este código, ignora este email.</p>
</body></html>`;
  const text = `Tu código de acceso a BuySell: ${code}\n\nCaduca en 10 minutos.`;

  if (!resend) {
    console.log(`\n========================`);
    console.log(`[auth-mobile] OTP para ${email}: ${code}`);
    console.log(`========================\n`);
  } else {
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[auth-mobile] Resend error:", error);
      return NextResponse.json(
        { error: "No se pudo enviar el email", detail: error.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
