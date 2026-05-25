/**
 * Computa el phash de fotos existentes que aún no lo tienen.
 * Uso: npm run hash-photos
 */
import { prisma } from "../src/lib/db";
import { dhashFromUrl } from "../src/lib/dhash";

async function main() {
  const pending = await prisma.media.findMany({
    where: { kind: "PHOTO", phash: null },
    select: { id: true, url: true, propertyId: true },
  });
  console.log(`Pendientes: ${pending.length}`);
  let ok = 0, fail = 0;
  for (let i = 0; i < pending.length; i++) {
    const m = pending[i];
    process.stdout.write(`[${i + 1}/${pending.length}] ${m.url.slice(0, 80)}… `);
    const h = await dhashFromUrl(m.url);
    if (h) {
      await prisma.media.update({ where: { id: m.id }, data: { phash: h } });
      ok++;
      console.log(`✓ ${h}`);
    } else {
      fail++;
      console.log("✗ (no se pudo)");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`\nOK: ${ok}  ·  Fail: ${fail}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
