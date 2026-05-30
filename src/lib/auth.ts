import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/db";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "Nidokey <auth@nidokey.es>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:4200";
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Provider Email de NextAuth implementado a mano (sin nodemailer) usando
 * Resend. Más ligero y compatible con Next 15 + Edge runtime futuro.
 */
const EmailResendProvider: NextAuthConfig["providers"][number] = {
  id: "email",
  type: "email",
  name: "Email",
  maxAge: 24 * 60 * 60, // 24h
  options: {},
  from: RESEND_FROM,
  server: {}, // no server, usamos sendVerificationRequest
  generateVerificationToken: () =>
    [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  async sendVerificationRequest({ identifier: email, url }) {
    console.log("[auth] sendVerificationRequest called", {
      email,
      url,
      RESEND_API_KEY_PRESENT: !!RESEND_API_KEY,
      RESEND_FROM,
      RESEND_INSTANCE: !!resend,
    });
    const subject = "Tu enlace de acceso a Nidokey";
    // HTML estricto: el enlace SOLO en un anchor con href; nada de URL en
    // texto plano que clientes como Proton podrían "linkificar" mal.
    const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 16px;color:#3A5F8A;">Nidokey Asturias</h2>
  <p>Pulsa el botón para entrar en tu cuenta:</p>
  <p style="margin:32px 0;text-align:center;">
    <a href="${url}" style="display:inline-block;padding:14px 28px;background:#3A5F8A;color:#FAFAF7;text-decoration:none;border-radius:8px;font-weight:500;">Acceder a Nidokey</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="font-size:12px;color:#999;">Si no solicitaste este email, ignóralo. El enlace caduca en 24 horas.</p>
</body></html>`;
    // Versión de texto: URL en su propia línea entre angle-brackets (RFC 3986
    // recomienda esto para que los parsers no incluyan texto adyacente).
    const text = `Pulsa este enlace para entrar en Nidokey:\n\n<${url}>\n\nEl enlace caduca en 24h. Si no lo solicitaste, ignóralo.`;

    if (!resend) {
      // Modo dev sin Resend: imprimir el enlace en consola
      console.log(`\n========================`);
      console.log(`[auth] Magic link para ${email}:`);
      console.log(`  ${url}`);
      console.log(`========================\n`);
      return;
    }
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
  },
};

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [EmailResendProvider],
  // JWT strategy: la sesión vive en una cookie firmada, no en BBDD.
  // Necesario para que el middleware pueda validar la sesión en Edge runtime
  // (Prisma no funciona en Edge).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?check=email",
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      // En el primer login, NextAuth nos pasa el user de la BBDD.
      // Guardamos el id en el token para que esté disponible en sesión.
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { APP_URL };
