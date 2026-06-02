import { runActorGetItems, type ApifyItem } from "@/features/sources/providers/apify";
import { pickStr, pickDate } from "@/features/sources/jobs/_item";
import {
  parseSalaryToCents,
  type IndeedSearchParams,
  type JobOffer,
} from "@/features/sources/jobs/types";

/**
 * Ingesta de ofertas de Indeed vía un actor de Apify.
 *
 * Actor por defecto: `valig/indeed-jobs-scraper` — pay-per-result **~$0.07–0.1/1k
 * (≈$0.0001/oferta), SIN mínimo por run**. Mismo autor que el de LinkedIn, así
 * que el patrón de input es consistente. Cubre 50+ países (ISO-2) → aporta más
 * localizaciones que InfoJobs (provincia España) y LinkedIn.
 * Input: { country, title, location, limit, datePosted }.
 * Configurable con `APIFY_INDEED_ACTOR`.
 *
 * OJO: este actor ABORTA el run si recibe `maxItems` en la query → se llama con
 * `omitChargeGuards:true` y el tope se pone por `limit` en el input.
 *
 * El output de Indeed viene con objetos ANIDADOS (location, employer, baseSalary,
 * description) — al revés que InfoJobs/LinkedIn (planos) — por eso aquí se extrae
 * a mano en vez de con `pickStr`.
 */
const DEFAULT_ACTOR = "valig/indeed-jobs-scraper";
const DEFAULT_COUNTRY = "es"; // app centrada en España; Indeed da granularidad de ciudad

function actorId(): string {
  return process.env.APIFY_INDEED_ACTOR?.trim() || DEFAULT_ACTOR;
}

function buildInput(p: IndeedSearchParams): Record<string, unknown> {
  if (p.actorInput) return p.actorInput;
  // Indeed busca por ciudad/zona libre (mejor granularidad que la provincia de
  // InfoJobs). Si se pide remoto sin zona, usamos "remote" como ubicación.
  const location = p.location?.trim() || (p.remote ? "remote" : "");
  return {
    country: p.country ?? DEFAULT_COUNTRY,
    title: p.keywords ?? "",
    location,
    limit: p.maxItems ?? 15,
    datePosted: p.datePosted ?? "7", // última semana
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Salario de Indeed: baseSalary {min,max,currencyCode}; importes plausibles → céntimos. */
function indeedSalary(item: ApifyItem): { min?: number; max?: number; currency?: string } {
  const sal = asRecord(item.baseSalary);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const ok = (n: number | null) => n != null && n >= 1000 && n <= 1_000_000; // descarta por hora/día
  const min = num(sal.min);
  const max = num(sal.max);
  const currency = typeof sal.currencyCode === "string" && sal.currencyCode ? sal.currencyCode : undefined;
  if (ok(min) || ok(max)) {
    return {
      min: ok(min) ? Math.round((min as number) * 100) : undefined,
      max: ok(max) ? Math.round((max as number) * 100) : undefined,
      currency,
    };
  }
  // Sin salario estructurado fiable: intentar texto libre (algunos items lo traen).
  const { min: tmin, max: tmax } = parseSalaryToCents(pickStr(item, "salaryText", "salary"));
  return { min: tmin, max: tmax, currency };
}

function normalize(item: ApifyItem): JobOffer {
  const loc = asRecord(item.location);
  const emp = asRecord(item.employer);
  const sal = indeedSalary(item);
  const city = typeof loc.city === "string" && loc.city ? loc.city : undefined;
  const countryName = typeof loc.countryName === "string" ? loc.countryName : undefined;
  // Ubicación legible: ciudad (+ país si no es España) o el texto que venga.
  const locationStr =
    [city, countryName && countryName !== "Spain" ? countryName : null].filter(Boolean).join(", ") ||
    pickStr(item, "formattedLocation") ||
    undefined;
  const jobTypes = Object.values(asRecord(item.jobTypes)).filter((v): v is string => typeof v === "string");
  const occupations = Object.values(asRecord(item.occupations)).filter((v): v is string => typeof v === "string");
  const descText = (() => {
    const d = asRecord(item.description);
    return typeof d.text === "string" ? d.text : pickStr(item, "description");
  })();
  const remote = /remote|remoto|teletrabaj/i.test(`${city ?? ""} ${jobTypes.join(" ")}`) || undefined;
  const companyLogoUrl = typeof emp.logoUrl === "string" && emp.logoUrl ? emp.logoUrl : undefined;

  return {
    platform: "indeed",
    externalId: pickStr(item, "key", "id", "refNum"),
    title: pickStr(item, "title") ?? "(sin título)",
    companyName: (typeof emp.name === "string" && emp.name) || pickStr(item, "company", "companyName") || "",
    location: locationStr,
    remote,
    description: descText,
    url: pickStr(item, "url", "jobUrl", "link") ?? "",
    applyUrl: pickStr(item, "jobUrl", "externalApplyLink", "applyUrl"),
    salaryMin: sal.min,
    salaryMax: sal.max,
    currency: sal.currency ?? "EUR",
    contractType: jobTypes.join(", ") || undefined,
    sector: occupations[0],
    companyLogoUrl,
    postedAt: pickDate(item, "datePublished", "dateOnIndeed", "postedAt"),
    scrapedAt: new Date(),
    raw: item,
  };
}

export async function ingestIndeedOffers(params: IndeedSearchParams): Promise<JobOffer[]> {
  // omitChargeGuards: este actor aborta si recibe maxItems en la query; el tope
  // va por `limit` en el input (ver buildInput) y el coste es ínfimo.
  const { items } = await runActorGetItems(actorId(), buildInput(params), {
    omitChargeGuards: true,
    timeoutSecs: 120,
  });
  return items.map(normalize).filter((o) => o.url || o.title !== "(sin título)");
}
