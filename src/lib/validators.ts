import { z } from "zod";

export const PropertyTypeEnum = z.enum([
  "HOUSE", "PISO", "ATICO", "CHALET", "DUPLEX", "ESTUDIO", "LOFT", "LOCAL", "TERRENO", "OTRO",
]);
export const PropertyStatusEnum = z.enum(["FOR_SALE", "RESERVED", "SOLD", "WITHDRAWN", "FOR_RENT", "RENTED"]);
export const EnergyRatingEnum = z.enum(["A", "B", "C", "D", "E", "F", "G", "UNKNOWN"]);
export const OperationTypeEnum = z.enum(["SALE", "RENT", "RENT_TO_OWN"]);
export const RentalContractTypeEnum = z.enum(["RESIDENTIAL", "SEASONAL", "ROOM", "COMMERCIAL"]);
export const FurnishedStateEnum = z.enum(["UNFURNISHED", "SEMI", "FURNISHED"]);

export const PropertyInput = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  type: PropertyTypeEnum,
  status: PropertyStatusEnum.default("FOR_SALE"),
  operationType: OperationTypeEnum.default("SALE"),
  currentPrice: z.coerce.number().int().nonnegative().optional().nullable(),

  // Alquiler (todos opcionales; precios en CÉNTIMOS al persistir).
  monthlyRent: z.coerce.number().int().nonnegative().optional().nullable(),
  deposit: z.coerce.number().int().nonnegative().optional().nullable(),
  minStayMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  maxStayMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  availableFrom: z.coerce.date().optional().nullable(),
  utilitiesIncluded: z.coerce.boolean().optional().nullable(),
  furnished: FurnishedStateEnum.optional().nullable(),
  petsAllowed: z.coerce.boolean().optional().nullable(),
  contractType: RentalContractTypeEnum.optional().nullable(),

  address: z.string().optional().nullable(),
  city: z.string().min(1),
  // Provincia puede venir vacía en creación manual (la columna es NOT NULL pero
  // admite ""); no la forzamos a ≥1 como antes.
  province: z.string().default(""),
  country: z.string().default("España"),
  postalCode: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  neighborhood: z.string().optional().nullable(),

  environment: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),

  rooms: z.coerce.number().int().optional().nullable(),
  bathrooms: z.coerce.number().int().optional().nullable(),
  builtArea: z.coerce.number().int().optional().nullable(),
  usableArea: z.coerce.number().int().optional().nullable(),
  plotArea: z.coerce.number().int().optional().nullable(),
  floor: z.string().optional().nullable(),
  hasElevator: z.coerce.boolean().optional().nullable(),
  hasGarage: z.coerce.boolean().optional().nullable(),
  hasStorage: z.coerce.boolean().optional().nullable(),
  hasTerrace: z.coerce.boolean().optional().nullable(),
  hasFireplace: z.coerce.boolean().optional().nullable(),
  hasGarden: z.coerce.boolean().optional().nullable(),
  hasPool: z.coerce.boolean().optional().nullable(),
  yearBuilt: z.coerce.number().int().optional().nullable(),
  energyRating: EnergyRatingEnum.default("UNKNOWN"),

  cadastralRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PropertyInputT = z.infer<typeof PropertyInput>;
