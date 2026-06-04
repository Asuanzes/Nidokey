import { prisma } from "@/lib/db";
import type { CryptoHolding, MarketInstrument, JobListing, BookRecord } from "@prisma/client";
import type { NormalizedRecord } from "@/features/sources/types";
import type { Book } from "@nidokey/shared";
import { openLibraryWorkDescription } from "@/features/sources/providers/open-library";

/**
 * Persiste un NormalizedRecord en su tabla de tipo. Generaliza el split
 * create/update de importListing: dedupe por la unique del tipo, actualiza
 * `currentValue` y escribe un *Snapshot SOLO si el valor cambió.
 *
 * De momento solo CRIPTO; al añadir tipos se amplía el switch.
 */
export async function upsertRecord(
  ownerId: string,
  normalized: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  if (normalized.recordType === "crypto") return upsertCrypto(ownerId, normalized);
  if (normalized.recordType === "market") return upsertMarket(ownerId, normalized);
  if (normalized.recordType === "job") return upsertJob(ownerId, normalized);
  if (normalized.recordType === "book") return upsertBook(ownerId, normalized);
  throw new Error(`upsertRecord: tipo no soportado todavía: ${normalized.recordType}`);
}

async function upsertCrypto(
  ownerId: string,
  n: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  const meta = (n.meta ?? {}) as Record<string, unknown>;
  const symbol = String(meta.symbol ?? "").toUpperCase();
  const quoteCurrency = String(meta.quoteCurrency ?? n.currency ?? "EUR").toUpperCase();
  const source = n.source;
  const value = n.currentValue ?? null;

  const existing = await prisma.cryptoHolding.findFirst({
    where: { ownerId, symbol, quoteCurrency, source },
  });

  if (!existing) {
    const created = await prisma.cryptoHolding.create({
      data: {
        ownerId,
        title: n.title,
        subtitle: n.subtitle ?? null,
        status: n.status ?? "WATCH",
        symbol,
        quoteCurrency,
        currentValue: value,
        currency: n.currency ?? quoteCurrency,
        imageUrl: n.imageUrl ?? null,
        source,
        externalId: n.externalId ?? null,
        lastCheckedAt: n.observedAt,
        meta: meta as object,
        snapshots:
          value != null
            ? { create: [{ value, source, observedAt: n.observedAt }] }
            : undefined,
      },
    });
    return { id: created.id, created: true, valueChanged: value != null };
  }

  const valueChanged = value != null && value !== existing.currentValue;
  await prisma.cryptoHolding.update({
    where: { id: existing.id },
    data: {
      // rellena solo lo que falta o el valor que sí cambia (no pisa edición)
      title: existing.title || n.title,
      imageUrl: existing.imageUrl ?? n.imageUrl ?? null,
      externalId: existing.externalId ?? n.externalId ?? null,
      currentValue: value ?? existing.currentValue,
      lastCheckedAt: n.observedAt,
      // refresca los datos de mercado (%24h, volumen, sparkline…)
      meta: { ...((existing.meta as Record<string, unknown>) ?? {}), ...meta } as object,
      ...(valueChanged
        ? { snapshots: { create: [{ value: value!, source, observedAt: n.observedAt }] } }
        : {}),
    },
  });
  return { id: existing.id, created: false, valueChanged };
}

/** Recarga la fila para devolverla mapeada a BaseRecord. */
export function getCryptoById(id: string): Promise<CryptoHolding | null> {
  return prisma.cryptoHolding.findUnique({ where: { id } });
}

async function upsertMarket(
  ownerId: string,
  n: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  const meta = (n.meta ?? {}) as Record<string, unknown>;
  const symbol = String(meta.symbol ?? "").toUpperCase();
  const source = n.source;
  const value = n.currentValue ?? null;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  const quoteCurrency = String(meta.quoteCurrency ?? n.currency ?? "USD").toUpperCase();

  const existing = await prisma.marketInstrument.findFirst({
    where: { ownerId, symbol, source },
  });

  if (!existing) {
    const created = await prisma.marketInstrument.create({
      data: {
        ownerId,
        title: n.title,
        subtitle: n.subtitle ?? null,
        status: n.status ?? "WATCH",
        symbol,
        exchange: str("exchange"),
        quoteCurrency,
        currentValue: value,
        currency: n.currency ?? quoteCurrency,
        imageUrl: n.imageUrl ?? null,
        source,
        externalId: n.externalId ?? symbol,
        lastCheckedAt: n.observedAt,
        meta: meta as object,
        snapshots:
          value != null ? { create: [{ value, source, observedAt: n.observedAt }] } : undefined,
      },
    });
    return { id: created.id, created: true, valueChanged: value != null };
  }

  const valueChanged = value != null && value !== existing.currentValue;
  await prisma.marketInstrument.update({
    where: { id: existing.id },
    data: {
      title: existing.title || n.title,
      currentValue: value ?? existing.currentValue,
      lastCheckedAt: n.observedAt,
      // refresca %día/volumen/sparkline (cambian aunque el precio no)
      meta: { ...((existing.meta as Record<string, unknown>) ?? {}), ...meta } as object,
      ...(valueChanged
        ? { snapshots: { create: [{ value: value!, source, observedAt: n.observedAt }] } }
        : {}),
    },
  });
  return { id: existing.id, created: false, valueChanged };
}

export function getMarketById(id: string): Promise<MarketInstrument | null> {
  return prisma.marketInstrument.findUnique({ where: { id } });
}

async function upsertJob(
  ownerId: string,
  n: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  const meta = (n.meta ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  const source = n.source;
  const externalId = n.externalId ?? null;
  const value = n.currentValue ?? null;
  const status = n.status ?? "OPEN";

  const existing = await prisma.jobListing.findFirst({
    where: { ownerId, externalId, source },
  });

  if (!existing) {
    const created = await prisma.jobListing.create({
      data: {
        ownerId,
        title: n.title,
        subtitle: n.subtitle ?? null,
        status,
        company: str("company"),
        location: str("location"),
        currentValue: value,
        currency: n.currency ?? "EUR",
        imageUrl: n.imageUrl ?? null,
        url: str("url"),
        platform: str("platform"),
        source,
        externalId,
        lastCheckedAt: n.observedAt,
        meta: meta as object,
        snapshots:
          value != null
            ? { create: [{ value, status, source: source ?? "apify", observedAt: n.observedAt }] }
            : undefined,
      },
    });
    return { id: created.id, created: true, valueChanged: value != null };
  }

  // Re-importar la misma oferta: refresca datos sin pisar lo que ya hubiera.
  await prisma.jobListing.update({
    where: { id: existing.id },
    data: {
      title: existing.title || n.title,
      imageUrl: existing.imageUrl ?? n.imageUrl ?? null,
      currentValue: value ?? existing.currentValue,
      lastCheckedAt: n.observedAt,
      meta: { ...((existing.meta as Record<string, unknown>) ?? {}), ...meta } as object,
    },
  });
  return { id: existing.id, created: false, valueChanged: false };
}

export function getJobById(id: string): Promise<JobListing | null> {
  return prisma.jobListing.findUnique({ where: { id } });
}

async function upsertBook(
  ownerId: string,
  n: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  const meta = { ...((n.meta ?? {}) as Record<string, unknown>) };
  // Sinopsis: Open Library no la trae en la búsqueda → la enriquecemos del work
  // API al guardar (Google sí la trae en volumeInfo). Best-effort, una llamada
  // gratis; si falla, se guarda sin sinopsis.
  const book = meta.book as Book | undefined;
  if (book?.source === "OPEN_LIBRARY" && !book.description && book.externalIds?.openLibraryWorkId) {
    try {
      const desc = await openLibraryWorkDescription(book.externalIds.openLibraryWorkId);
      if (desc) meta.book = { ...book, description: desc };
    } catch {
      /* sin sinopsis → seguimos */
    }
  }
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  const source = n.source;
  const externalId = n.externalId ?? null;
  const value = n.currentValue ?? null; // rating*100 (opcional)

  const existing = await prisma.bookRecord.findFirst({
    where: { ownerId, externalId, source },
  });

  if (!existing) {
    const created = await prisma.bookRecord.create({
      data: {
        ownerId,
        title: n.title,
        subtitle: n.subtitle ?? null,
        status: n.status ?? "WISHLIST",
        authors: str("authors"),
        isbn13: str("isbn13"),
        currentValue: value,
        currency: n.currency ?? null,
        imageUrl: n.imageUrl ?? null,
        source,
        externalId,
        lastCheckedAt: n.observedAt,
        meta: meta as object,
      },
    });
    return { id: created.id, created: true, valueChanged: value != null };
  }

  // Re-importar el mismo libro: refresca rating/portada/datos sin pisar lo editado.
  const valueChanged = value != null && value !== existing.currentValue;
  await prisma.bookRecord.update({
    where: { id: existing.id },
    data: {
      title: existing.title || n.title,
      imageUrl: existing.imageUrl ?? n.imageUrl ?? null,
      currentValue: value ?? existing.currentValue,
      lastCheckedAt: n.observedAt,
      meta: { ...((existing.meta as Record<string, unknown>) ?? {}), ...meta } as object,
    },
  });
  return { id: existing.id, created: false, valueChanged };
}

export function getBookById(id: string): Promise<BookRecord | null> {
  return prisma.bookRecord.findUnique({ where: { id } });
}
