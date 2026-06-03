import { prisma } from "@/lib/db";

/**
 * Comprueba que un Property pertenece al usuario. Helper ÚNICO de ownership
 * (extraído del inline que vivía en `properties/[id]/route.ts`) para que todos
 * los endpoints de propiedad apliquen la misma comprobación y no se repitan
 * olvidos como los IDOR de `/similar` y `/merge`.
 *
 * Devuelve `true` si `id` existe y su `ownerId` === `ownerId`. `false` si no
 * existe o es de otro usuario → los handlers lo traducen a 404 (no 403) para no
 * filtrar la existencia de recursos ajenos.
 */
export async function ensurePropertyOwner(id: string, ownerId: string): Promise<boolean> {
  const exists = await prisma.property.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  return !!exists;
}
