/**
 * Modelo de dominio UNIFICADO de "registros" (records).
 *
 * Nidokey nació como catálogo de inmuebles, pero la app está pensada para
 * escalar a más tipos de registro (cryptos, jobs, workouts, holidays,
 * renting…). Para no reescribir la UI por cada tipo nuevo, toda la capa de
 * presentación trabaja contra `BaseRecord`: un contrato común con los campos
 * que TODA tarjeta/lista/cabecera necesita. Los campos específicos de cada
 * tipo viven en `meta` (sin tipar en la base) y se resuelven en el detalle.
 *
 * Compartido web ↔ mobile vía @nidokey/shared. No importa Prisma ni runtime
 * de Node: es solo tipos + helpers puros.
 */

/** Tipos de registro. Solo `property` está implementado; el resto está
 * reservado para que añadir un tipo = añadir un valor aquí + su config.
 * El orden define el del menú de filtros en la app móvil. */
export type RecordType =
  | "property"
  | "renting"
  | "holiday"
  | "crypto"
  | "market"
  | "job"
  | "workout"
  | "chat";

export const RECORD_TYPES: RecordType[] = [
  "property",
  "renting",
  "holiday",
  "crypto",
  "market",
  "job",
  "workout",
  "chat",
];

/**
 * Contrato común a todo registro, independiente del tipo.
 * La lista y la cabecera del detalle se construyen SOLO con estos campos.
 */
export interface BaseRecord {
  id: string;
  type: RecordType;
  /** Línea principal (ej. título del inmueble, par de cripto, puesto…). */
  title: string;
  /** Línea secundaria (ej. ciudad · barrio, exchange, empresa…). */
  subtitle?: string | null;
  /** Estado libre por tipo (ej. property: FOR_SALE / SOLD). */
  status?: string | null;
  /** Métrica destacada ya formateada (ej. precio "320.000 €"). */
  primaryValue?: string | null;
  /** Imagen principal (primera foto, logo, etc.). */
  imageUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Campos específicos del tipo, sin tipar en la base. */
  meta: Record<string, unknown>;
}

/** Parámetros de listado de registros (filtros comunes a todos los tipos). */
export interface RecordListParams {
  type?: RecordType;
  query?: string;
  limit?: number;
}

/** Lee un campo tipado de `meta` con fallback seguro. */
export function metaField<T>(record: BaseRecord, key: string, fallback: T): T {
  const v = record.meta?.[key];
  return (v === undefined || v === null ? fallback : (v as T));
}
