import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

/**
 * Configuración mínima para Edge runtime (middleware).
 *
 * No incluye adapter Prisma, ni Resend, ni nada que requiera Node runtime.
 * Solo lo justo para que `auth()` pueda validar el JWT de la cookie de sesión.
 *
 * La config completa (con providers, adapter) vive en `src/lib/auth.ts` y se
 * usa en API routes / server components (Node runtime).
 */
export const authEdgeConfig: NextAuthConfig = {
  providers: [], // sin providers — el middleware no los necesita
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

// Exportamos solo `auth` para usar en middleware
export const { auth } = NextAuth(authEdgeConfig);
