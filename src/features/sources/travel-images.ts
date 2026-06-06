/**
 * Thumbnails del vertical VIAJES con fallback.
 *
 * - Transporte: imagen genérica por modo (avión/tren/bus/coche). Amadeus no da
 *   foto del medio, así que se usa un asset estático por modo.
 * - Alojamiento: primera imagen REAL disponible; si falta o es "perezosa"
 *   (placeholder), cae a una genérica por tipo.
 *
 * Reutiliza `isLazyCover` (src/features/sources/upsert.ts) — misma regla de
 * "esta URL no es una imagen real, usa el fallback" que en libros. Los assets
 * viven en public/travel/ (servidos en /travel/*.svg).
 */
import type { AccommodationChoice, AccommodationKind, TransportMode } from "@nidokey/shared";
import { isLazyCover } from "@/features/sources/upsert";

/** Asset genérico por modo de transporte (en public/travel/). */
export const TRANSPORT_THUMBNAILS: Record<TransportMode, string> = {
  flight: "/travel/flight.svg",
  train: "/travel/train.svg",
  bus: "/travel/bus.svg",
  car: "/travel/car.svg",
};

/** Asset genérico por tipo de alojamiento (hoy todos comparten "hotel"). */
const ACCOMMODATION_THUMBNAILS: Record<AccommodationKind, string> = {
  hotel: "/travel/hotel.svg",
  apartment: "/travel/hotel.svg",
  rental: "/travel/hotel.svg",
};

/** Imagen genérica del destino (fallback de cabecera de viaje). */
export const DESTINATION_THUMBNAIL = "/travel/destination.svg";

/** Thumbnail del desplazamiento: siempre el genérico del modo. */
export function transportThumbnail(mode: TransportMode): string {
  return TRANSPORT_THUMBNAILS[mode] ?? DESTINATION_THUMBNAIL;
}

/**
 * Thumbnail del alojamiento: primera imagen real (thumbnail→large); si falta o
 * es perezosa, genérico por tipo.
 */
export function accommodationThumbnail(choice: AccommodationChoice): string {
  const real = choice.imageUrls?.thumbnail ?? choice.imageUrls?.large ?? null;
  if (real && !isLazyCover(real)) return real;
  return ACCOMMODATION_THUMBNAILS[choice.kind] ?? DESTINATION_THUMBNAIL;
}
