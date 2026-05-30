import { formatPrice, type BaseRecord } from "@nidokey/shared";
import type { Property, Media } from "@prisma/client";

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
