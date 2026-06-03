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
  /** Listing más antiguo (portal de origen del inmueble). */
  listings?: { portal: string }[];
};

export function propertyToRecord(p: RawPropertyListItem): BaseRecord {
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
      footnote,
      portal: p.listings?.[0]?.portal ?? null,
    },
  };
}

/** Forma de resultado que devuelve GET /api/search (proyección reducida). */
export type RawSearchResult = {
  id: string;
  title: string;
  city: string;
  neighborhood?: string | null;
  currentPrice: number | null;
  type: string;
  media?: { url: string }[];
};

export function searchResultToRecord(r: RawSearchResult): BaseRecord {
  return {
    id: r.id,
    type: "property",
    title: r.title,
    subtitle: [r.city, r.neighborhood].filter(Boolean).join(" · ") || null,
    status: null,
    primaryValue: r.currentPrice != null ? formatPrice(r.currentPrice) : null,
    imageUrl: r.media?.[0]?.url ?? null,
    meta: { propertyType: r.type, city: r.city, neighborhood: r.neighborhood ?? null },
  };
}
