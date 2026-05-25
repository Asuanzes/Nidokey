/**
 * Tipos compartidos web ↔ mobile. Se mantienen sincronizados a mano con
 * el schema Prisma de apps/web/prisma/schema.prisma.
 *
 * NO importamos @prisma/client aquí: ese paquete depende del runtime de
 * Node y no se ejecuta en React Native.
 */

export type Portal =
  | "IDEALISTA"
  | "FOTOCASA"
  | "PISOS_COM"
  | "MILANUNCIOS"
  | "HABITACLIA"
  | "YAENCONTRE"
  | "THINKSPAIN"
  | "INDOMIO"
  | "OTHER"
  | "MANUAL";

export type PropertyType =
  | "HOUSE"
  | "PISO"
  | "ATICO"
  | "CHALET"
  | "DUPLEX"
  | "ESTUDIO"
  | "LOFT"
  | "LOCAL"
  | "TERRENO"
  | "OTRO";

export type PropertyStatus = "FOR_SALE" | "RESERVED" | "SOLD" | "WITHDRAWN";

export type ListingStatus =
  | "ACTIVE"
  | "PRICE_DROP"
  | "PRICE_UP"
  | "SOLD"
  | "REMOVED"
  | "UNKNOWN";

export type MediaKind = "PHOTO" | "FLOORPLAN" | "VIDEO" | "TOUR_3D" | "DOCUMENT";

export type MediaSource =
  | "USER_UPLOAD"
  | "PORTAL_SCRAPE"
  | "CADASTRE"
  | "AI_SKETCH"
  | "AI_RECONSTRUCTION";

export type EnergyRating = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "UNKNOWN";

/** Property "ligera" para listados (sin todas las relaciones). */
export type PropertyListItem = {
  id: string;
  title: string;
  type: PropertyType;
  status: PropertyStatus;
  city: string;
  province: string;
  neighborhood: string | null;
  currentPrice: number | null;
  rooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  media: { url: string }[];
  priceHistory: { price: number; observedAt: string }[];
};

/** Property completa con todas sus relaciones. */
export type PropertyDetail = PropertyListItem & {
  description: string | null;
  address: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  usableArea: number | null;
  plotArea: number | null;
  floor: string | null;
  yearBuilt: number | null;
  hasElevator: boolean | null;
  hasGarage: boolean | null;
  hasStorage: boolean | null;
  hasTerrace: boolean | null;
  hasFireplace: boolean | null;
  hasGarden: boolean | null;
  hasPool: boolean | null;
  energyRating: EnergyRating;
  cadastralRef: string | null;
  cadastralData: unknown;
  tags: string[];
  notes: string | null;
  media: Array<{
    id: string;
    kind: MediaKind;
    source: MediaSource;
    url: string;
    caption: string | null;
    order: number;
    phash: string | null;
  }>;
  listings: Array<{
    id: string;
    portal: Portal;
    url: string;
    status: ListingStatus;
    lastPrice: number | null;
    lastCheckedAt: string | null;
  }>;
  priceHistory: Array<{
    id: string;
    price: number;
    source: Portal;
    observedAt: string;
  }>;
};

export type MatchCandidate = {
  propertyId: string;
  title: string;
  city: string;
  thumbnailUrl: string | null;
  portals: Portal[];
  currentPrice: number | null;
  score: number;
  reasons: string[];
};

export type ApiError = {
  error: string;
  code?: string | null;
  detail?: string | null;
};
