import { formatPrice, type BaseRecord } from "@nidokey/shared";

/**
 * Mappers: traducen las respuestas de los endpoints existentes
 * (/api/properties) al modelo unificado `BaseRecord`. Aislar el mapeo aquí
 * permite cambiar el backend a /api/records en el futuro tocando solo el
 * repositorio, sin tocar la UI.
 */

/** Forma mínima de Property que devuelve GET /api/properties (lista). */
export type RawPropertyListItem = {
  id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
  type: string;
  status: string;
  currentPrice: number | null;
  rooms?: number | null;
  bathrooms?: number | null;
  builtArea?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  media?: { url: string }[];
};

export function propertyToRecord(p: RawPropertyListItem): BaseRecord {
  const subtitle = [p.city, p.neighborhood].filter(Boolean).join(" · ") || null;
  return {
    id: p.id,
    type: "property",
    title: p.title,
    subtitle,
    status: p.status,
    primaryValue: p.currentPrice != null ? formatPrice(p.currentPrice) : null,
    imageUrl: p.media?.[0]?.url ?? null,
    createdAt: p.createdAt ?? null,
    updatedAt: p.updatedAt ?? null,
    meta: {
      propertyType: p.type,
      city: p.city,
      neighborhood: p.neighborhood ?? null,
      currentPrice: p.currentPrice,
      rooms: p.rooms ?? null,
      bathrooms: p.bathrooms ?? null,
      builtArea: p.builtArea ?? null,
    },
  };
}
