import { z } from "zod";

export const PropertyTypeEnum = z.enum([
  "HOUSE", "PISO", "ATICO", "CHALET", "DUPLEX", "ESTUDIO", "LOFT", "LOCAL", "TERRENO", "OTRO",
]);
export const PropertyStatusEnum = z.enum(["FOR_SALE", "RESERVED", "SOLD", "WITHDRAWN"]);
export const EnergyRatingEnum = z.enum(["A", "B", "C", "D", "E", "F", "G", "UNKNOWN"]);

export const PropertyInput = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  type: PropertyTypeEnum,
  status: PropertyStatusEnum.default("FOR_SALE"),
  currentPrice: z.coerce.number().int().nonnegative().optional().nullable(),

  address: z.string().optional().nullable(),
  city: z.string().min(1),
  province: z.string().min(1),
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
