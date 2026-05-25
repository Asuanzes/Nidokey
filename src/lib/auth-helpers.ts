import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { verifyMobileJwt } from "@/lib/mobile-jwt";

/**
 * Resuelve el userId del request actual.
 *
 * Soporta dos fuentes:
 *  1. Cookie de NextAuth (web).
 *  2. Authorization: Bearer <JWT> (mobile, firmado por issueMobileJwt).
 *
 * Devuelve null si ninguna es válida.
 */
export async function getUserId(): Promise<string | null> {
  // 1. Sesión cookie (web)
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  // 2. Bearer JWT (mobile)
  try {
    const h = await headers();
    const authHeader = h.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const verified = await verifyMobileJwt(token);
      if (verified) return verified.userId;
    }
  } catch {
    // headers() puede lanzar fuera de un request context; ignoramos
  }
  return null;
}

/**
 * Lanza si no hay sesión válida. Para usar en rutas protegidas.
 */
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error("No autenticado");
  return id;
}
