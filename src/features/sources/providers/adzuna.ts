/**
 * Cliente fino de la API de Adzuna (empleo). Las claves (`app_id`/`app_key`)
 * SOLO viven en el servidor (env) — nunca en el cliente. Devuelve los resultados
 * crudos; el mapeo a NormalizedRecord lo hace el adapter.
 *
 * Doc: https://developer.adzuna.com/  ·  País España = "es".
 */
const BASE = "https://api.adzuna.com/v1/api/jobs";
const COUNTRY = "es";

export type AdzunaJob = {
  id: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string; // "0" | "1"
  contract_type?: string; // permanent | contract
  contract_time?: string; // full_time | part_time
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string; tag?: string };
};

export async function searchAdzunaJobs(
  what: string,
  where: string | undefined,
  opts?: { page?: number; perPage?: number }
): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Faltan ADZUNA_APP_ID / ADZUNA_APP_KEY en el entorno");
  }
  const page = opts?.page ?? 1;
  const qs = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(opts?.perPage ?? 20),
    what,
    "content-type": "application/json",
  });
  if (where && where.trim()) qs.set("where", where.trim());

  const res = await fetch(`${BASE}/${COUNTRY}/search/${page}?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Adzuna respondió ${res.status}`);
  const data = (await res.json()) as { results?: AdzunaJob[] };
  return data.results ?? [];
}
