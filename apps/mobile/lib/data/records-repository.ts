import { api } from "@/lib/api";
import type { BaseRecord, RecordListParams } from "@nidokey/shared";
import {
  propertyToRecord,
  type RawPropertyListItem,
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

  // Cripto (y futuros tipos): el backend ya devuelve BaseRecord[] desde
  // /api/records — no hace falta mapper de cliente. Requiere desplegar
  // /api/records + migración en producción para tener datos.
  if (type === "crypto" || type === "market") {
    return api<BaseRecord[]>(`/api/records?type=${type}`);
  }

  // Tipos reservados: sin backend todavía.
  return [];
}

/**
 * Borra un registro. Enruta por tipo:
 *  - property → DELETE /api/properties/:id (endpoint ya en producción).
 *  - resto    → DELETE /api/records/:id?type= (requiere el handler desplegado).
 * Cascada en BD (listings, snapshots, media) la hace el backend.
 */
export async function deleteRecord(record: BaseRecord): Promise<void> {
  if (record.type === "property") {
    await api(`/api/properties/${record.id}`, { method: "DELETE" });
    return;
  }
  await api(`/api/records/${record.id}?type=${record.type}`, { method: "DELETE" });
}

/**
 * Búsqueda global de registros. Hoy consulta /api/search (solo inmuebles) y
 * mapea a BaseRecord. Devuelve [] para queries de menos de 2 caracteres.
 */
export async function searchRecords(query: string): Promise<BaseRecord[]> {
  if (query.trim().length < 2) return [];
  // Búsqueda UNIFICADA (propiedades + cripto + mercados): con scope=all el
  // backend ya devuelve BaseRecord[], sin mapper de cliente.
  const data = await api<{ results: BaseRecord[] }>(
    `/api/search?q=${encodeURIComponent(query)}&scope=all`
  );
  return data.results ?? [];
}
