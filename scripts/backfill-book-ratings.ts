/**
 * Backfill de VALORACIONES de libros.
 *
 * Rellena `averageRating` / `ratingsCount` (en `meta.book`) + `currentValue` de los
 * `BookRecord` que NO tienen nota, buscándola en Open Library (por work id o por
 * ISBN) — mismo criterio que `upsertBook`. NO sobrescribe ratings existentes.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/backfill-book-ratings.ts          (DRY RUN)
 *   node --env-file=.env --import tsx scripts/backfill-book-ratings.ts --apply  (escribe)
 */
import type { Book } from "@nidokey/shared";

import { prisma } from "../src/lib/db";
import {
  openLibraryWorkRatings,
  openLibraryRatingByIsbn,
} from "../src/features/sources/providers/open-library";

const APPLY = process.argv.includes("--apply");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rows = await prisma.bookRecord.findMany({ orderBy: { createdAt: "asc" } });
  const withBook = rows
    .map((row) => ({ row, book: ((row.meta as Record<string, unknown>) ?? {}).book as Book | undefined }))
    .filter((x) => x.book);
  const candidates = withBook.filter((x) => x.book!.averageRating == null);

  console.log(
    `${rows.length} libros · ${candidates.length} sin nota · modo: ${APPLY ? "APLICAR ✍️" : "DRY RUN (no escribe)"}`
  );

  let filled = 0;
  let noRating = 0;
  let noKey = 0;
  for (const { row, book } of candidates) {
    const workId = book!.externalIds?.openLibraryWorkId ?? null;
    const isbn = book!.isbn13 ?? null;
    if (!workId && !isbn) {
      noKey++;
      console.log(`  · ${row.title} — sin ISBN ni work id, no se puede buscar`);
      continue;
    }

    let r: { average: number; count: number | null } | null = null;
    try {
      r =
        (workId ? await openLibraryWorkRatings(workId) : null) ??
        (isbn ? await openLibraryRatingByIsbn(isbn) : null);
    } catch {
      r = null;
    }
    await sleep(400); // cortesía con Open Library

    if (!r) {
      noRating++;
      console.log(`  ⊘ ${row.title} — Open Library no tiene nota`);
      continue;
    }

    filled++;
    console.log(`  ★ ${row.title} — ${r.average} (${r.count ?? 0} votos)`);
    if (APPLY) {
      const meta = { ...((row.meta as Record<string, unknown>) ?? {}) };
      meta.book = { ...book!, averageRating: r.average, ratingsCount: r.count };
      await prisma.bookRecord.update({
        where: { id: row.id },
        data: { currentValue: Math.round(r.average * 100), meta: meta as object },
      });
    }
  }

  console.log(
    `\nResumen: ${filled} ${APPLY ? "rellenados" : "rellenables"} · ${noRating} sin nota en OL · ${noKey} sin clave de búsqueda`
  );
  if (!APPLY && filled > 0) console.log("→ vuelve a ejecutar con --apply para escribirlos.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
