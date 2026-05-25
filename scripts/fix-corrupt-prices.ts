/**
 * Limpieza one-off: marca como "necesita re-import" los Property/Listing
 * con precios sospechosos. NO los borra — solo identifica.
 *
 * Uso: npm run fix-prices
 *
 * Identifica:
 *  - currentPrice < 10.000 €  (probablemente cuota mensual capturada como precio)
 *  - lastPrice < 10.000 €
 *  - builtArea > 5000 m²      (probablemente €/m² capturado como área)
 *  - usableArea > 5000 m²
 */
import { prisma } from "../src/lib/db";
import { isValidPriceEur, isValidBuiltArea } from "../packages/shared/src/sanity";

async function main() {
  console.log("Buscando datos corruptos…\n");

  const props = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      currentPrice: true,
      builtArea: true,
      usableArea: true,
      plotArea: true,
      listings: { select: { id: true, url: true, lastPrice: true, portal: true } },
    },
  });

  let fixed = 0;
  let suspicious = 0;
  for (const p of props) {
    const updates: Record<string, unknown> = {};
    const issues: string[] = [];

    if (p.currentPrice != null) {
      // currentPrice está en céntimos → divide por 100 para validar
      const eur = p.currentPrice / 100;
      if (!isValidPriceEur(eur)) {
        updates.currentPrice = null;
        issues.push(`currentPrice=${eur}€ (rango inválido)`);
      }
    }
    if (p.builtArea != null && !isValidBuiltArea(p.builtArea)) {
      updates.builtArea = null;
      issues.push(`builtArea=${p.builtArea} m² (fuera de rango)`);
    }
    if (p.usableArea != null && !isValidBuiltArea(p.usableArea)) {
      updates.usableArea = null;
      issues.push(`usableArea=${p.usableArea} m² (fuera de rango)`);
    }

    if (issues.length === 0) continue;

    suspicious++;
    console.log(`📋 ${p.title.slice(0, 60)} (${p.id})`);
    issues.forEach((i) => console.log(`   ⚠ ${i}`));
    await prisma.property.update({ where: { id: p.id }, data: updates });
    fixed++;

    // Listings con lastPrice corrupto: ponerlo a null + borrar snapshots erróneos
    for (const l of p.listings) {
      if (l.lastPrice != null && !isValidPriceEur(l.lastPrice / 100)) {
        console.log(`   ⚠ Listing ${l.portal} lastPrice=${l.lastPrice / 100}€ → reset`);
        await prisma.listing.update({ where: { id: l.id }, data: { lastPrice: null } });
        // Borrar snapshots con precio inválido
        const bad = await prisma.priceSnapshot.deleteMany({
          where: { listingId: l.id, price: { lt: 1_000_000 } }, // < 10k€
        });
        if (bad.count > 0) console.log(`     ↳ ${bad.count} snapshots inválidos borrados`);
      }
    }
  }

  console.log(`\nResumen: ${suspicious} fichas sospechosas, ${fixed} normalizadas.`);
  console.log("Reimporta las afectadas con el userscript para repoblar los campos correctos.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
