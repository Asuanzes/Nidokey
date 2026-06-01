import type { BaseRecord, RecordType } from "@nidokey/shared";
import { getItem, setItem } from "@/lib/secure-store";

/**
 * Orden manual de las tarjetas, GUARDADO LOCAL en el dispositivo (SecureStore).
 * No se sincroniza con la web (decisión de producto: el orden es una preferencia
 * de vista personal del móvil). Una clave por tipo: `nidokey.order.<tipo>`.
 */
const orderKey = (type: RecordType) => `nidokey.order.${type}`;

export async function getSavedOrder(type: RecordType): Promise<string[]> {
  try {
    const raw = await getItem(orderKey(type));
    if (!raw) return [];
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveOrder(type: RecordType, ids: string[]): Promise<void> {
  try {
    await setItem(orderKey(type), JSON.stringify(ids));
  } catch {
    // SecureStore tiene un límite de tamaño por valor; si se superara, el orden
    // simplemente no se persiste. Para catálogos personales no se alcanza.
  }
}

/**
 * Aplica un orden guardado (lista de ids) a los registros recién traídos.
 * Mandan los ids guardados; los registros nuevos (no en la lista) van al final
 * conservando su orden original (más reciente primero); los ids obsoletos se
 * ignoran.
 */
export function applySavedOrder(records: BaseRecord[], savedIds: string[]): BaseRecord[] {
  if (savedIds.length === 0) return records;
  const byId = new Map(records.map((r) => [r.id, r]));
  const out: BaseRecord[] = [];
  const used = new Set<string>();
  for (const id of savedIds) {
    const r = byId.get(id);
    if (r) {
      out.push(r);
      used.add(id);
    }
  }
  for (const r of records) {
    if (!used.has(r.id)) out.push(r);
  }
  return out;
}
