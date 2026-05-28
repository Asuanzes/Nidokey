import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Devuelve el token API del usuario; si no tiene, crea uno automáticamente.
 * Usado para inyectar en los userscripts dinámicos y para validar imports.
 */
export async function getOrCreateUserToken(userId: string, label?: string): Promise<string> {
  const existing = await prisma.apiToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.token;

  const token = generateToken();
  await prisma.apiToken.create({
    data: { userId, token, label: label ?? "Bookmarklet" },
  });
  return token;
}

/**
 * Resuelve un token a su userId. Devuelve null si no existe.
 * Marca `lastUsed` para auditoría.
 */
export async function resolveUserFromToken(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;
  const row = await prisma.apiToken.findUnique({
    where: { token },
    select: { userId: true, id: true },
  });
  if (!row) return null;
  // Best-effort: actualizar lastUsed sin bloquear el flujo
  prisma.apiToken.update({ where: { id: row.id }, data: { lastUsed: new Date() } }).catch(() => {});
  return row.userId;
}

/**
 * Extrae token de un Request:
 *   - Header: `Authorization: Bearer <token>`
 *   - Query string: `?token=<token>`
 */
export function extractTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  return q?.trim() || null;
}

function generateToken(): string {
  // 32 bytes → 64 chars hex. Prefijo legible para identificar en logs.
  return `nk_${randomBytes(32).toString("hex")}`;
}
