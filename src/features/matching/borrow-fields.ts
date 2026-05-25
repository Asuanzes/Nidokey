import { prisma } from "@/lib/db";
import { findSimilar } from "./find-similar";

const BORROWABLE_FIELDS = [
  "description",
  "address",
  "postalCode",
  "neighborhood",
  "latitude",
  "longitude",
  "rooms",
  "bathrooms",
  "builtArea",
  "usableArea",
  "plotArea",
  "floor",
  "yearBuilt",
  "hasElevator",
  "hasGarage",
  "hasStorage",
  "hasTerrace",
  "hasFireplace",
  "hasGarden",
  "hasPool",
] as const;

const MIN_SCORE = 70;

export type BorrowResult = {
  borrowed: string[];
  fromPropertyId: string | null;
  score: number | null;
};

/**
 * Si la Property `id` tiene campos NULL pero existe una Property similar
 * (score ≥ 70) con esos campos rellenos, "pide prestado" esos valores.
 *
 * NO fusiona las dos propiedades — solo copia datos puntuales. Es para
 * enriquecer fichas pobres con datos de fichas hermanas (típicamente el
 * mismo inmueble en otro portal con extracción más completa).
 */
export async function borrowFieldsFromSimilar(id: string): Promise<BorrowResult> {
  const me = await prisma.property.findUnique({ where: { id } });
  if (!me) return { borrowed: [], fromPropertyId: null, score: null };

  // ¿Tiene campos vacíos que merezca la pena rellenar?
  const missing = BORROWABLE_FIELDS.filter((f) => {
    const v = (me as unknown as Record<string, unknown>)[f];
    return v == null || v === "";
  });
  if (missing.length === 0) return { borrowed: [], fromPropertyId: null, score: null };

  const candidates = await findSimilar(id);
  const donor = candidates.find((c) => c.score >= MIN_SCORE);
  if (!donor) return { borrowed: [], fromPropertyId: null, score: null };

  const source = await prisma.property.findUnique({ where: { id: donor.propertyId } });
  if (!source) return { borrowed: [], fromPropertyId: null, score: null };

  const patch: Record<string, unknown> = {};
  const borrowed: string[] = [];
  for (const f of missing) {
    const v = (source as unknown as Record<string, unknown>)[f];
    if (v != null && v !== "") {
      patch[f] = v;
      borrowed.push(f);
    }
  }
  if (borrowed.length === 0) {
    return { borrowed: [], fromPropertyId: donor.propertyId, score: donor.score };
  }

  await prisma.property.update({ where: { id }, data: patch });
  return { borrowed, fromPropertyId: donor.propertyId, score: donor.score };
}
