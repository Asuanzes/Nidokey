import { api } from "@/lib/api";
import type { BaseRecord, RecordListParams } from "@nidokey/shared";
import {
  propertyToRecord,
  searchResultToRecord,
  type RawPropertyListItem,
  type RawSearchResult,
} from "@/lib/records/mappers";

/**
 * Repositorio de registros: ÚNICA puerta de entrada a los datos de records.
 *
 * Hoy traduce los endpoints existentes (/api/properties) al modelo
 * `BaseRecord`. Cuando el backend exponga /api/records (ya implementado pero
 * sin desplegar), solo cambia este archivo — ni la UI ni los hooks se tocan.
 *
 * Tipos aún no implementados (crypto, job…) devuelven [] de momento.
 */
export async function fetchRecords(params: RecordListParams = {}): Promise<BaseRecord[]> {
  const type = params.type ?? "property";

  if (type === "property") {
    const qs = params.query ? `?q=${encodeURIComponent(params.query)}` : "";
    const rows = await api<RawPropertyListItem[]>(`/api/properties${qs}`);
    return rows.map(propertyToRecord);
  }

  // Tipos reservados: sin backend todavía.
  return [];
}

/**
 * Búsqueda global de registros. Hoy consulta /api/search (solo inmuebles) y
 * mapea a BaseRecord. Devuelve [] para queries de menos de 2 caracteres.
 */
export async function searchRecords(query: string): Promise<BaseRecord[]> {
  if (query.trim().length < 2) return [];
  const data = await api<{ results: RawSearchResult[] }>(
    `/api/search?q=${encodeURIComponent(query)}`
  );
  return data.results.map(searchResultToRecord);
}
