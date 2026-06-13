/**
 * Resetea la caché de menús de los restaurantes de Google (menuFetchedAt +
 * menuSourceUrl a NULL) para que se vuelvan a scrapear con la cascada nueva
 * (Crawl4AI + Claude → Firecrawl de respaldo). Idempotente y seguro de re-ejecutar.
 *
 * Ejecutar SOLO después de que Vercel tenga CRAWL4AI_URL / CRAWL4AI_SECRET /
 * ANTHROPIC_API_KEY y haya redesplegado; si no, los reintentos caen al respaldo.
 *
 * Uso: node --env-file=.env --import tsx scripts/reset-food-menus.ts
 */
import { prisma } from "../src/lib/db";

async function main() {
  const total = await prisma.restaurant.count({ where: { source: "google" } });
  const cached = await prisma.restaurant.count({ where: { source: "google", menuFetchedAt: { not: null } } });
  console.log(`[reset-food-menus] Restaurantes Google: ${total} (con menú cacheado: ${cached})`);

  const r = await prisma.restaurant.updateMany({
    where: { source: "google" },
    data: { menuFetchedAt: null, menuSourceUrl: null },
  });
  console.log(`[reset-food-menus] Reseteados ${r.count} → reintentarán al abrirlos/descubrirlos (Crawl4AI + Claude).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[reset-food-menus] error:", e);
    process.exit(1);
  });
