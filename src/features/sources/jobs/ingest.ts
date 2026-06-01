import { ingestInfoJobsOffers } from "@/features/sources/jobs/ingest-infojobs";
import { ingestLinkedInOffers } from "@/features/sources/jobs/ingest-linkedin";
import {
  jobOfferToNormalized,
  type JobOffer,
  type JobPlatform,
  type LinkedInSearchParams,
} from "@/features/sources/jobs/types";

/**
 * Coordinador de ingesta de empleo: lanza la búsqueda en las plataformas
 * indicadas y devuelve `JobOffer[]` normalizado. POC: sin BBDD (ver
 * `saveJobOffers`).
 */
export type IngestJobsParams = LinkedInSearchParams & {
  /** Plataformas a consultar. Default ["infojobs"] (España, más barato). */
  platforms?: JobPlatform[];
};

export async function ingestJobs(params: IngestJobsParams): Promise<JobOffer[]> {
  const platforms = params.platforms ?? ["infojobs"];
  const out: JobOffer[] = [];
  for (const p of platforms) {
    if (p === "infojobs") out.push(...(await ingestInfoJobsOffers(params)));
    else if (p === "linkedin") out.push(...(await ingestLinkedInOffers(params)));
    // "indeed" / "other": pendientes (siguiente iteración)
  }
  return out;
}

/**
 * ESQUELETO de persistencia. Mapea cada oferta al DTO universal del framework
 * (`NormalizedRecord`) y deja el upsert como TODO — en esta iteración NO se toca
 * Prisma. Cuando exista la tabla `JobListing` + el case "job" en `upsert.ts`,
 * esto será un bucle con `upsertRecord(ownerId, n)`.
 */
export async function saveJobOffers(
  ownerId: string,
  offers: JobOffer[]
): Promise<{ saved: number; pending: number }> {
  const normalized = offers.map(jobOfferToNormalized);
  // TODO(jobs-vertical): persistir
  //   1) Prisma: modelos JobListing/JobSnapshot (aditivo, `prisma db push`).
  //   2) src/features/sources/upsert.ts: case "job" → upsertJob(ownerId, n).
  //   3) for (const n of normalized) await upsertRecord(ownerId, n);
  console.log(
    `[jobs] saveJobOffers: ${normalized.length} ofertas normalizadas listas para ` +
      `upsert (ownerId=${ownerId}); persistencia pendiente (TODO vertical empleo).`
  );
  return { saved: 0, pending: normalized.length };
}
