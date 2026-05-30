import { api } from "@/lib/api";
import type { BaseRecord, RecordListParams } from "@nidokey/shared";
import { propertyToRecord, type RawPropertyListItem } from "@/lib/records/mappers";

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
