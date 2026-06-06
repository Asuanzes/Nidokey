import { prisma } from "@/lib/db";
import type { RecordType, BaseRecord, Book, DedupCandidate } from "@nidokey/shared";
import { findDuplicateGroups } from "@nidokey/shared";
import {
  bookToBaseRecord,
  cryptoToBaseRecord,
  marketToBaseRecord,
  jobToBaseRecord,
} from "@/lib/records/mapper";

/**
 * Escaneo ON-DEMAND de duplicados de REGISTROS (no se almacenan sugerencias).
 *
 * Carga las fichas del usuario por tipo, las proyecta a `DedupCandidate` (claves
 * desde columnas + `meta.book`), excluye los pares descartados, y agrupa con el
 * motor genérico de `@nidokey/shared/dedup`. Cada grupo lleva sus registros ya
 * mapeados a `BaseRecord` (mismos mappers que `/api/records`) para que el cliente
 * pinte cualquier tipo sin lógica específica.
 *
 * `property` NO entra aquí: tiene su propio motor inmobiliario (`/api/matches`).
 */
const DEDUP_TYPES: RecordType[] = ["book", "crypto", "market", "job"];

export interface DuplicateGroupResult {
  type: RecordType;
  score: number;
  reasons: string[];
  records: BaseRecord[];
}

export async function scanDuplicates(
  ownerId: string,
  only?: RecordType,
): Promise<DuplicateGroupResult[]> {
  const types = only ? (DEDUP_TYPES.includes(only) ? [only] : []) : DEDUP_TYPES;
  if (types.length === 0) return [];

  // Descartes del usuario, agrupados por tipo → Set de pairKeys.
  const dismissals = await prisma.recordDuplicateDismissal.findMany({ where: { ownerId } });
  const dismissedByType = new Map<string, Set<string>>();
  for (const d of dismissals) {
    const set = dismissedByType.get(d.recordType) ?? new Set<string>();
    set.add(d.pairKey);
    dismissedByType.set(d.recordType, set);
  }

  const out: DuplicateGroupResult[] = [];
  for (const type of types) {
    const { candidates, byId } = await loadCandidates(ownerId, type);
    if (candidates.length < 2) continue;
    const groups = findDuplicateGroups(candidates, {
      dismissedPairs: dismissedByType.get(type) ?? new Set<string>(),
    });
    for (const g of groups) {
      const records = g.ids.map((id) => byId.get(id)).filter((r): r is BaseRecord => !!r);
      if (records.length < 2) continue;
      out.push({ type: g.type, score: g.score, reasons: g.reasons, records });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Carga las fichas de un tipo y devuelve candidatos para el motor + el mapa
 *  id→BaseRecord (para serializar los grupos). Tope alto (escala personal). */
async function loadCandidates(
  ownerId: string,
  type: RecordType,
): Promise<{ candidates: DedupCandidate[]; byId: Map<string, BaseRecord> }> {
  const candidates: DedupCandidate[] = [];
  const byId = new Map<string, BaseRecord>();

  if (type === "book") {
    const rows = await prisma.bookRecord.findMany({ where: { ownerId }, take: 500 });
    for (const r of rows) {
      const b = (r.meta as { book?: Book } | null)?.book;
      candidates.push({
        id: r.id,
        type: "book",
        title: r.title,
        keys: {
          isbn13: b?.isbn13 ?? r.isbn13 ?? null,
          isbn10: b?.isbn10 ?? null,
          workId: b?.externalIds?.openLibraryWorkId ?? null,
          authors: b?.authors ?? (r.authors ? [r.authors] : []),
          language: b?.language ?? null,
        },
      });
      byId.set(r.id, bookToBaseRecord(r));
    }
    return { candidates, byId };
  }

  if (type === "crypto") {
    const rows = await prisma.cryptoHolding.findMany({ where: { ownerId }, take: 500 });
    for (const r of rows) {
      candidates.push({ id: r.id, type: "crypto", title: r.title, keys: { symbol: r.symbol } });
      byId.set(r.id, cryptoToBaseRecord(r));
    }
    return { candidates, byId };
  }

  if (type === "market") {
    const rows = await prisma.marketInstrument.findMany({ where: { ownerId }, take: 500 });
    for (const r of rows) {
      candidates.push({ id: r.id, type: "market", title: r.title, keys: { symbol: r.symbol } });
      byId.set(r.id, marketToBaseRecord(r));
    }
    return { candidates, byId };
  }

  if (type === "job") {
    const rows = await prisma.jobListing.findMany({ where: { ownerId }, take: 500 });
    for (const r of rows) {
      candidates.push({
        id: r.id,
        type: "job",
        title: r.title,
        keys: { url: r.url, externalId: r.externalId, company: r.company, location: r.location },
      });
      byId.set(r.id, jobToBaseRecord(r));
    }
    return { candidates, byId };
  }

  return { candidates, byId };
}
