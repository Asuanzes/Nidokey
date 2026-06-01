import { formatPrice, formatMoney, type BaseRecord } from "@nidokey/shared";
import type { Property, Media, CryptoHolding, MarketInstrument, JobListing } from "@prisma/client";

/**
 * Mapper server-side: Property (Prisma) -> BaseRecord (modelo unificado).
 *
 * Espeja el mapper móvil (apps/mobile/lib/records/mappers.ts) pero parte de la
 * fila Prisma (fechas como Date). De momento el tipo es siempre "property";
 * cuando se use el discriminador `recordType` de la tabla, se leerá aquí.
 */
export type PropertyWithCover = Property & { media?: Pick<Media, "url">[] };

export function propertyToBaseRecord(p: PropertyWithCover): BaseRecord {
  const subtitle = [p.city, p.neighborhood].filter(Boolean).join(" · ") || null;
  const footnote =
    [
      p.rooms != null ? `${p.rooms} hab` : null,
      p.bathrooms != null ? `${p.bathrooms} baño${p.bathrooms !== 1 ? "s" : ""}` : null,
      p.builtArea != null ? `${p.builtArea} m²` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  return {
    id: p.id,
    type: "property",
    title: p.title,
    subtitle,
    status: p.status,
    primaryValue: p.currentPrice != null ? formatPrice(p.currentPrice) : null,
    imageUrl: p.media?.[0]?.url ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    meta: {
      propertyType: p.type,
      city: p.city,
      neighborhood: p.neighborhood,
      currentPrice: p.currentPrice,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      builtArea: p.builtArea,
      footnote,
    },
  };
}

/** CryptoHolding (Prisma) -> BaseRecord. */
export function cryptoToBaseRecord(c: CryptoHolding): BaseRecord {
  return {
    id: c.id,
    type: "crypto",
    title: c.title,
    subtitle: c.subtitle,
    status: c.status,
    primaryValue: c.currentValue != null ? formatMoney(c.currentValue, c.currency) : null,
    imageUrl: c.imageUrl,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    meta: {
      symbol: c.symbol,
      quoteCurrency: c.quoteCurrency,
      quantity: c.quantity != null ? c.quantity.toString() : null,
      source: c.source,
      externalId: c.externalId,
      // Hora del último refresco real (no del último UPDATE de fila): la UI la
      // usa para mostrar "Actualizado hace X" y detectar datos congelados.
      lastCheckedAt: c.lastCheckedAt?.toISOString() ?? null,
      ...((c.meta as Record<string, unknown> | null) ?? {}),
    },
  };
}

/** MarketInstrument (Prisma) -> BaseRecord. */
export function marketToBaseRecord(m: MarketInstrument): BaseRecord {
  return {
    id: m.id,
    type: "market",
    title: m.title,
    subtitle: m.subtitle,
    status: m.status,
    primaryValue: m.currentValue != null ? formatMoney(m.currentValue, m.currency) : null,
    imageUrl: m.imageUrl,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    meta: {
      symbol: m.symbol,
      exchange: m.exchange,
      quoteCurrency: m.quoteCurrency,
      quantity: m.quantity != null ? m.quantity.toString() : null,
      source: m.source,
      externalId: m.externalId,
      // Hora del último refresco real (ver cryptoToBaseRecord).
      lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
      ...((m.meta as Record<string, unknown> | null) ?? {}),
    },
  };
}

/** JobListing (Prisma) -> BaseRecord. Salario en primaryValue; resto en meta
 *  (company, location, url, platform, footnote…) que ya viene del normalizado. */
export function jobToBaseRecord(j: JobListing): BaseRecord {
  return {
    id: j.id,
    type: "job",
    title: j.title,
    subtitle: j.subtitle,
    status: j.status,
    primaryValue: j.currentValue != null ? formatMoney(j.currentValue, j.currency ?? "EUR") : null,
    imageUrl: j.imageUrl,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
    meta: {
      company: j.company,
      location: j.location,
      url: j.url,
      platform: j.platform,
      source: j.source,
      externalId: j.externalId,
      lastCheckedAt: j.lastCheckedAt?.toISOString() ?? null,
      ...((j.meta as Record<string, unknown> | null) ?? {}),
    },
  };
}
