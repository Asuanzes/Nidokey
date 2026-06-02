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
import { ingestIndeedOffers } from "@/features/sources/jobs/ingest-indeed";
import { isProvinceName, normLocation } from "@/features/sources/jobs/province";
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
  if (p === "indeed") return "Indeed";
  return "";
}

/** Fuentes de empleo disponibles, en orden de intercalado (InfoJobs primero). */
const ALL_SOURCES = ["infojobs", "linkedin", "indeed"] as const;
type JobSource = (typeof ALL_SOURCES)[number];

function wantedSources(sources?: string[]): Set<JobSource> {
  const sel = (sources ?? []).filter((s): s is JobSource =>
    (ALL_SOURCES as readonly string[]).includes(s)
  );
  // Sin selección válida → todas (comportamiento por defecto).
  return new Set(sel.length > 0 ? sel : ALL_SOURCES);
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
    const want = wantedSources(opts?.sources);
    // InfoJobs necesita palabra clave (sin ella devuelve 0); LinkedIn e Indeed sí
    // buscan solo por zona. Cada fuente solo se ejecuta si está elegida → coste 0
    // por las no seleccionadas.
    const hasKeyword = query.trim().length >= 2;
    const none = Promise.resolve([] as JobOffer[]);
    const [infojobs, linkedin, indeed] = await Promise.all([
      want.has("infojobs") && hasKeyword
        ? ingestInfoJobsOffers({ ...base, maxItems: 20 }).catch(() => [] as JobOffer[])
        : none,
      want.has("linkedin")
        ? ingestLinkedInOffers({ ...base, maxItems: 15 }).catch(() => [] as JobOffer[])
        : none,
      want.has("indeed")
        ? ingestIndeedOffers({ ...base, maxItems: 15 }).catch(() => [] as JobOffer[])
        : none,
    ]);
    // Intercala (InfoJobs, LinkedIn, Indeed) para que se vean todas arriba; dedup.
    const merged: JobOffer[] = [];
    const max = Math.max(infojobs.length, linkedin.length, indeed.length);
    for (let i = 0; i < max; i++) {
      if (infojobs[i]) merged.push(infojobs[i]);
      if (linkedin[i]) merged.push(linkedin[i]);
      if (indeed[i]) merged.push(indeed[i]);
    }
    const seen = new Set<string>();
    const deduped = merged.filter((o) => {
      const k = o.url || `${o.platform}:${o.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Búsqueda EXPLÍCITA por ciudad: si la zona es una ciudad concreta (no una
    // provincia entera), mostrar solo ofertas de ESA ciudad (InfoJobs busca por
    // provincia y LinkedIn por geo amplia, así que filtramos aquí). Si no queda
    // ninguna, se cae a la provincia para no dejar la pantalla vacía.
    const loc = opts?.location?.trim();
    let result = deduped;
    if (loc && !isProvinceName(loc)) {
      const term = normLocation(loc.split(",")[0]);
      if (term) {
        const city = deduped.filter((o) => normLocation(o.location ?? "").includes(term));
        if (city.length > 0) result = city;
      }
    }
    return result.slice(0, 30).map(hitFor);
  },
};
