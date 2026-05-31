import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { verifyMobileJwt } from "@/lib/mobile-jwt";
import { resolveUserFromToken } from "@/lib/api-token";

/**
 * Resuelve el userId del request actual. ÚNICO punto de verdad de identidad.
 *
 * Soporta TRES fuentes, en este orden:
 *  1. Cookie de NextAuth (web).
 *  2. Authorization: Bearer <JWT> móvil (firmado por issueMobileJwt).
 *  3. Authorization: Bearer <bs_…> token de API (bookmarklet/userscripts).
 *
 * Que todos los endpoints usen este resolver (vía requireUserId) elimina la
 * clase de error de "token inválido" que surgía cuando /api/listings/import
 * reimplementaba su propia lógica de auth en paralelo.
 *
 * Devuelve null si ninguna es válida.
 */
export async function getUserId(): Promise<string | null> {
  // 1. Sesión cookie (web)
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  // 2 y 3. Bearer: JWT móvil o token bs_ — un único sitio para ambos
  try {
    const h = await headers();
    const authHeader = h.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      // 2. JWT móvil (issuer nidokey-mobile)
      const verified = await verifyMobileJwt(token);
      if (verified) return verified.userId;
      // 3. Token de API bs_ (bookmarklet / userscripts)
      const ownerId = await resolveUserFromToken(token);
      if (ownerId) return ownerId;
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
