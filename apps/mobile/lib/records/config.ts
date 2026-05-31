import type { Ionicons } from "@expo/vector-icons";
import type { RecordType } from "@nidokey/shared";

/**
 * Registry de tipos de registro para la UI móvil.
 *
 * Añadir un tipo nuevo a la interfaz = añadir una entrada aquí (label, color,
 * icono) + su valor en `RecordType` (shared). La lista, los chips de filtro y
 * la cabecera del detalle leen de aquí, así que no hay que tocar pantallas.
 *
 * `enabled: false` = tipo reservado (se muestra como "Próximamente" y su chip
 * de filtro queda deshabilitado).
 */
export type RecordTypeConfig = {
  /** Etiqueta plural para listas y chips (ej. "Inmuebles"). */
  label: string;
  /** Etiqueta singular para cabeceras de detalle (ej. "Inmueble"). */
  singular: string;
  /** Color de acento del tipo. */
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Si el tipo está implementado de extremo a extremo. */
  enabled: boolean;
};

export const RECORD_TYPE_CONFIG: Record<RecordType, RecordTypeConfig> = {
  property: { label: "Inmuebles",  singular: "Inmueble",  color: "#3A5F8A", icon: "home-outline",         enabled: true },
  renting:  { label: "Alquiler",   singular: "Alquiler",  color: "#7A5BA6", icon: "key-outline",          enabled: false },
  holiday:  { label: "Vacaciones", singular: "Vacación",  color: "#2C7A8A", icon: "airplane-outline",     enabled: false },
  crypto:   { label: "Criptos",    singular: "Cripto",    color: "#B87333", icon: "logo-bitcoin",         enabled: false },
  market:   { label: "Markets",    singular: "Mercado",   color: "#2D6A4F", icon: "trending-up-outline",  enabled: false },
  job:      { label: "Empleos",    singular: "Empleo",    color: "#A86A17", icon: "briefcase-outline",    enabled: false },
};

export function recordTypeConfig(type: RecordType): RecordTypeConfig {
  return RECORD_TYPE_CONFIG[type];
}
