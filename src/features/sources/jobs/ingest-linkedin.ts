import { runActorGetItems, type ApifyItem } from "@/features/sources/providers/apify";
import { pickStr, pickDate } from "@/features/sources/jobs/_item";
import { withCountry } from "@/features/sources/jobs/province";
import {
  parseSalaryToCents,
  type JobOffer,
  type LinkedInSearchParams,
} from "@/features/sources/jobs/types";

/**
 * Ingesta de ofertas de LinkedIn vía un actor de Apify.
 *
 * Actor por defecto: `valig/linkedin-jobs-scraper` (pay-per-result ~$0.28–0.4/1k;
 * el más barato fiable). Input conocido: title, location, datePosted,
 * contractType, experienceLevel, remote (array), limit (≤1000).
 * Configurable con `APIFY_LINKEDIN_ACTOR`.
 *
 * Nota POC: el salario de LinkedIn varía por país; no forzamos moneda (se asume
 * EUR luego en el mapper). El input lo conocemos, así que esta ingesta es más
 * fiable que la de InfoJobs (cuyo esquema depende del actor elegido).
 */
const DEFAULT_ACTOR = "valig/linkedin-jobs-scraper";

function actorId(): string {
  return process.env.APIFY_LINKEDIN_ACTOR?.trim() || DEFAULT_ACTOR;
}

function buildInput(p: LinkedInSearchParams): Record<string, unknown> {
  if (p.actorInput) return p.actorInput;
  const input: Record<string, unknown> = {
    title: p.keywords,
    // Sin país, LinkedIn geolocaliza mal ("Vitoria" → Brasil) → añadimos ", Spain".
    location: withCountry(p.location),
    datePosted: p.datePosted ?? "r604800", // última semana
    limit: p.maxItems ?? 25,
  };
  if (p.remote) input.remote = ["2"]; // 2 = Remoto (3 = Híbrido)
  return input;
}

function normalize(item: ApifyItem): JobOffer {
  const { min, max } = parseSalaryToCents(pickStr(item, "salary"));
  const workType = pickStr(item, "workType") ?? "";
  return {
    platform: "linkedin",
    externalId: pickStr(item, "id", "jobId"),
    title: pickStr(item, "title") ?? "(sin título)",
    companyName: pickStr(item, "companyName", "company") ?? "",
    location: pickStr(item, "location"),
    remote: /remote|remoto/i.test(workType) || undefined,
    description: pickStr(item, "description"),
    url: pickStr(item, "url", "link") ?? "",
    applyUrl: pickStr(item, "applyUrl"),
    salaryMin: min,
    salaryMax: max,
    currency: min != null ? "EUR" : undefined, // moneda incierta en LinkedIn
    contractType: pickStr(item, "contractType"),
    experienceLevel: pickStr(item, "experienceLevel"),
    sector: pickStr(item, "sector"),
    companyLogoUrl: pickStr(item, "companyLogo", "logo", "companyLogoUrl"),
    postedAt: pickDate(item, "postedDate", "postedAt"),
    scrapedAt: new Date(),
    raw: item,
  };
}

export async function ingestLinkedInOffers(
  params: LinkedInSearchParams
): Promise<JobOffer[]> {
  const { items } = await runActorGetItems(actorId(), buildInput(params), {
    maxItems: params.maxItems ?? 25,
  });
  return items.map(normalize).filter((o) => o.url || o.title !== "(sin título)");
}
