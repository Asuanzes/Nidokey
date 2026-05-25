/**
 * Atribuye todas las Property sin ownerId al usuario indicado por email.
 * Uso:
 *   npm run claim-orphans -- belquivir@proton.me
 */
import { prisma } from "../src/lib/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: npm run claim-orphans -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Usuario ${email} no encontrado. Logueate en /login primero.`);
    process.exit(1);
  }

  const orphans = await prisma.property.count({ where: { ownerId: null } });
  console.log(`Property huérfanas (ownerId=null): ${orphans}`);
  if (orphans === 0) {
    console.log("Nada que reclamar.");
    process.exit(0);
  }

  const result = await prisma.property.updateMany({
    where: { ownerId: null },
    data: { ownerId: user.id },
  });
  console.log(`✓ ${result.count} Property atribuidas a ${email} (${user.id})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
