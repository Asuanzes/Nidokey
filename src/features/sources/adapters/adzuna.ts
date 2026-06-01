import type { FetchOutcome, NormalizedRecord, SourceAdapter, SourceInput } from "@/features/sources/types";
import { searchAdzunaJobs, type AdzunaJob } from "@/features/sources/providers/adzuna";

/**
 * Adaptador de EMPLEO vía Adzuna (API oficial, agregador legal — NO scraping).
 *
 * Adzuna es un BUSCADOR (multi-resultado): el usuario busca (qué + dónde), elige
 * una oferta y la registra. Por eso este adapter implementa `search()` (devuelve
 * varios candidatos) en lugar de `fetch()` (uno). El registro del elegido se hace
 * por el canal `input.kind === "record"` de /api/records/import.
 */
const SOURCE = "adzuna";

function eurToCents(v?: number | null): number | null {
  return v != null && isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
}

function salaryText(min: number | null, max: number | null, predicted: boolean): string | null {
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
  let base: string | null = null;
  if (min != null && max != null && min !== max) base = `${fmt(min)}–${fmt(max)} €/año`;
  else if (max != null) base = `${fmt(max)} €/año`;
  else if (min != null) base = `desde ${fmt(min)} €/año`;
  if (!base) return null;
  return predicted ? `${base} (est.)` : base;
}

function toNormalized(j: AdzunaJob): NormalizedRecord | null {
  if (!j.id || !j.title) return null;
  const company = j.company?.display_name ?? null;
  const location = j.location?.display_name ?? null;
  const minEur = j.salary_min ?? null;
  const maxEur = j.salary_max ?? null;
  const predicted = j.salary_is_predicted === "1";
  const refEur = maxEur ?? minEur ?? null; // salario de referencia (máximo)
  const contractTime = j.contract_time ? j.contract_time.replace("_", " ") : null;

  return {
    recordType: "job",
    title: j.title,
    subtitle: [company, location].filter(Boolean).join(" · ") || null,
    status: "WATCH",
    currentValue: eurToCents(refEur),
    currency: "EUR",
    imageUrl: null,
    source: SOURCE,
    externalId: j.id,
    observedAt: new Date(),
    meta: {
      company,
      location,
      salaryMin: eurToCents(minEur),
      salaryMax: eurToCents(maxEur),
      salaryPredicted: predicted,
      salaryText: salaryText(minEur, maxEur, predicted),
      contractType: j.contract_type ?? null,
      contractTime: j.contract_time ?? null,
      category: j.category?.label ?? null,
      url: j.redirect_url ?? null,
      redirectUrl: j.redirect_url ?? null,
      description: j.description ? j.description.slice(0, 1200) : null,
      created: j.created ?? null,
      footnote: [contractTime, j.category?.label].filter(Boolean).join(" · ") || null,
    },
  };
}

export const adzunaAdapter: SourceAdapter = {
  type: "job",
  source: SOURCE,

  identify(input: SourceInput): boolean {
    return input.kind === "search";
  },

  async fetch(): Promise<FetchOutcome> {
    return {
      kind: "error",
      error: "Adzuna es un buscador: usa search() y registra el candidato elegido.",
    };
  },

  async search({ what, where }: { what: string; where?: string }): Promise<NormalizedRecord[]> {
    const jobs = await searchAdzunaJobs(what, where, { perPage: 20 });
    return jobs.map(toNormalized).filter((r): r is NormalizedRecord => r != null);
  },
};
