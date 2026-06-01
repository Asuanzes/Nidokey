import { prisma } from "@/lib/db";
import type { CryptoHolding, JobListing } from "@prisma/client";
import type { NormalizedRecord } from "@/features/sources/types";

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
  if (normalized.recordType === "job") return upsertJob(ownerId, normalized);
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

async function upsertJob(
  ownerId: string,
  n: NormalizedRecord
): Promise<{ id: string; created: boolean; valueChanged: boolean }> {
  const meta = (n.meta ?? {}) as Record<string, unknown>;
  const source = n.source;
  const externalId = n.externalId ?? null;
  const value = n.currentValue ?? null;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  const num = (k: string) => (typeof meta[k] === "number" ? (meta[k] as number) : null);

  const fields = {
    title: n.title,
    subtitle: n.subtitle ?? null,
    company: str("company"),
    location: str("location"),
    salaryMin: num("salaryMin"),
    salaryMax: num("salaryMax"),
    contractType: str("contractType"),
    contractTime: str("contractTime"),
    category: str("category"),
    redirectUrl: str("redirectUrl") ?? str("url"),
    currentValue: value,
    currency: n.currency ?? "EUR",
    imageUrl: n.imageUrl ?? null,
    source,
    externalId,
    lastCheckedAt: n.observedAt,
    meta: meta as object,
  };

  const existing = externalId
    ? await prisma.jobListing.findFirst({ where: { ownerId, source, externalId } })
    : null;

  if (!existing) {
    const created = await prisma.jobListing.create({
      data: {
        ownerId,
        status: n.status ?? "WATCH",
        ...fields,
        snapshots:
          value != null ? { create: [{ value, source, observedAt: n.observedAt }] } : undefined,
      },
    });
    return { id: created.id, created: true, valueChanged: value != null };
  }

  const valueChanged = value != null && value !== existing.currentValue;
  await prisma.jobListing.update({
    where: { id: existing.id },
    data: {
      ...fields,
      // no pisa el estado de candidatura editado por el usuario
      status: existing.status ?? n.status ?? "WATCH",
      ...(valueChanged
        ? { snapshots: { create: [{ value: value!, source, observedAt: n.observedAt }] } }
        : {}),
    },
  });
  return { id: existing.id, created: false, valueChanged };
}

export function getJobById(id: string): Promise<JobListing | null> {
  return prisma.jobListing.findUnique({ where: { id } });
}
