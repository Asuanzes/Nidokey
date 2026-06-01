import type {
  FetchOutcome,
  NormalizedRecord,
  SearchHit,
  SearchOpts,
  SourceAdapter,
  SourceInput,
} from "@/features/sources/types";
import { ingestInfoJobsOffers } from "@/features/sources/jobs/ingest-infojobs";
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

/** Candidato para el buscador: muestra título/empresa/ubicación y lleva el record. */
function hitFor(o: JobOffer): SearchHit {
  const record = jobOfferToNormalized(o);
  return {
    symbol: "", // empleo no se re-fetchea por símbolo; los datos van en `record`
    name: o.title,
    exchange: [o.companyName, "InfoJobs"].filter(Boolean).join(" · ") || null,
    type: o.location ?? null,
    record,
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
    const offers = await ingestInfoJobsOffers({
      keywords: query,
      location: opts?.location,
      remote: opts?.remote,
      maxItems: 12,
    });
    return offers.slice(0, 12).map(hitFor);
  },
};
