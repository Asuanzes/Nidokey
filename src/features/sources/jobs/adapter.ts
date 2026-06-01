import type {
  FetchOutcome,
  NormalizedRecord,
  SearchHit,
  SearchOpts,
  SourceAdapter,
  SourceInput,
} from "@/features/sources/types";
import { ingestInfoJobsOffers } from "@/features/sources/jobs/ingest-infojobs";
import { ingestLinkedInOffers } from "@/features/sources/jobs/ingest-linkedin";
import { jobOfferToNormalized, type JobOffer } from "@/features/sources/jobs/types";

/**
 * Adaptador de EMPLEO vía Apify (por defecto InfoJobs — España). Encaja en el
 * framework como cripto/mercado, pero con un matiz de coste: cada búsqueda
 * cuesta dinero (actor de pago). Por eso:
 *  - `search(query)` corre el actor UNA vez y devuelve candidatos con su
 *    `record` ya normalizado embebido,
 *  - al elegir uno, el móvil importa con `kind:"record"` → se guarda tal cual
 *    SIN volver a llamar a Apify (coste 0 al elegir).
 *
 * `fetch({kind:"query"})` existe por si se importa la primera coincidencia sin
 * elegir (no lo usa el flujo del móvil).
 */
const SOURCE = "apify";

function platformLabel(p: JobOffer["platform"]): string {
  if (p === "linkedin") return "LinkedIn";
  if (p === "infojobs") return "InfoJobs";
  return "";
}

/** Candidato para el buscador: muestra título/empresa/plataforma/ubicación y lleva el record. */
function hitFor(o: JobOffer): SearchHit {
  return {
    symbol: "", // empleo no se re-fetchea por símbolo; los datos van en `record`
    name: o.title,
    exchange: [o.companyName, platformLabel(o.platform)].filter(Boolean).join(" · ") || null,
    type: o.location ?? null,
    record: jobOfferToNormalized(o),
  };
}

export const apifyJobsAdapter: SourceAdapter = {
  type: "job",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "query";
  },

  async fetch(input: SourceInput): Promise<FetchOutcome> {
    if (input.kind !== "query") {
      return { kind: "error", error: "Empleo requiere una búsqueda (palabras clave)" };
    }
    try {
      const offers = await ingestInfoJobsOffers({ keywords: input.query, maxItems: 5 });
      const first = offers[0];
      if (!first) return { kind: "gone", reason: `Sin ofertas para "${input.query}"` };
      return { kind: "ok", record: jobOfferToNormalized(first) as NormalizedRecord };
    } catch (e) {
      return { kind: "error", error: e instanceof Error ? e.message : String(e) };
    }
  },

  async search(query: string, opts?: SearchOpts): Promise<SearchHit[]> {
    const base = { keywords: query, location: opts?.location, remote: opts?.remote };
    // InfoJobs necesita palabra clave (sin ella devuelve 0); LinkedIn sí busca
    // solo por zona. Si no hay puesto → solo LinkedIn (por ubicación).
    const hasKeyword = query.trim().length >= 2;
    const [infojobs, linkedin] = await Promise.all([
      hasKeyword
        ? ingestInfoJobsOffers({ ...base, maxItems: 20 }).catch(() => [] as JobOffer[])
        : Promise.resolve([] as JobOffer[]),
      ingestLinkedInOffers({ ...base, maxItems: 15 }).catch(() => [] as JobOffer[]),
    ]);
    // Intercala para que se vean ambas fuentes arriba; dedup por URL.
    const merged: JobOffer[] = [];
    const max = Math.max(infojobs.length, linkedin.length);
    for (let i = 0; i < max; i++) {
      if (infojobs[i]) merged.push(infojobs[i]);
      if (linkedin[i]) merged.push(linkedin[i]);
    }
    const seen = new Set<string>();
    const deduped = merged.filter((o) => {
      const k = o.url || `${o.platform}:${o.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return deduped.slice(0, 30).map(hitFor);
  },
};
