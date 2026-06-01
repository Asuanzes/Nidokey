import { runActorGetItems, type ApifyItem } from "@/features/sources/providers/apify";
import { pickStr, pickDate } from "@/features/sources/jobs/_item";
import {
  parseSalaryToCents,
  type InfoJobsSearchParams,
  type JobOffer,
} from "@/features/sources/jobs/types";

/**
 * Ingesta de ofertas de InfoJobs vía un actor de Apify.
 *
 * Actor por defecto: `alvaraaz/infojobs-actor` — pay-per-event **$2/1.000
 * (~$0.002/oferta), SIN mínimo por run** → apto para el plan free. Input:
 * { keywords, location (provincia), workModel: remote|hybrid|onsite, jobsNumber }.
 * (Evitar `studio-amba/infojobs-scraper`: exige permitir mínimo $5/run, y
 * `scrapestorm/…-barato-cheap`: es alquiler $19.89/mes.)
 *
 * Configurable con `APIFY_INFOJOBS_ACTOR`. Si usas otro actor con distinto
 * esquema de input, pásalo exacto vía `params.actorInput`.
 *
 * Nota: alvaraaz tiene `jobsNumber` mínimo 20 → cada run trae ≥20 ofertas
 * (~$0.04). El tope `maxTotalChargeUsd` del provider ($0.10) acota el gasto.
 */
const DEFAULT_ACTOR = "alvaraaz/infojobs-actor";

function actorId(): string {
  return process.env.APIFY_INFOJOBS_ACTOR?.trim() || DEFAULT_ACTOR;
}

function buildInput(p: InfoJobsSearchParams): Record<string, unknown> {
  if (p.actorInput) return p.actorInput;
  const input: Record<string, unknown> = {
    keywords: p.keywords,
    location: p.location ?? "",
    jobsNumber: Math.max(20, p.maxItems ?? 25), // mínimo del actor
  };
  if (p.remote) input.workModel = "remote";
  return input;
}

function normalize(item: ApifyItem): JobOffer {
  const salaryRaw = pickStr(item, "salary", "salaryDescription", "salaryText");
  const { min, max } = parseSalaryToCents(salaryRaw);
  const workMode =
    pickStr(item, "workModel", "workMode", "modality", "workplaceType", "jobType") ?? "";
  return {
    platform: "infojobs",
    externalId: pickStr(item, "id", "offerId", "offer_id"),
    title: pickStr(item, "title", "jobTitle", "name") ?? "(sin título)",
    companyName:
      pickStr(item, "company", "companyName", "company_name", "employer") ?? "",
    location: pickStr(item, "location", "city", "province", "place"),
    remote: /remot|teletrabaj/i.test(workMode) || undefined,
    description: pickStr(item, "description", "descriptionSnippet", "snippet", "summary"),
    url: pickStr(item, "url", "offerUrl", "offer_url", "link") ?? "",
    applyUrl: pickStr(item, "applyUrl", "applicationUrl"),
    salaryMin: min,
    salaryMax: max,
    currency: "EUR", // InfoJobs es España → EUR seguro
    contractType: pickStr(item, "contractType", "contract", "workSchedule", "schedule"),
    experienceLevel: pickStr(item, "experience", "experienceLevel", "studiesLevel"),
    sector: pickStr(item, "category", "sector", "subcategory"),
    companyLogoUrl: pickStr(item, "companyLogo", "companyLogoUrl", "logo", "logoUrl"),
    postedAt: pickDate(item, "postedDate", "publishedAt", "published", "date"),
    scrapedAt: new Date(),
    raw: item,
  };
}

export async function ingestInfoJobsOffers(
  params: InfoJobsSearchParams
): Promise<JobOffer[]> {
  const { items } = await runActorGetItems(actorId(), buildInput(params), {
    maxItems: params.maxItems ?? 25,
  });
  return items.map(normalize).filter((o) => o.url || o.title !== "(sin título)");
}
