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
/**
 * Cómo se añade un registro de este tipo:
 *  - "url":    pegar/compartir una URL → extracción en WebView (inmuebles…).
 *  - "symbol": teclear un símbolo → fetch server-side por API (cripto, mercados).
 *  - "search": buscador (qué + dónde) → elegir un candidato (empleo, viajes…).
 *  - "soon":   aún no disponible (se muestra "Próximamente").
 */
export type AddMode = "url" | "symbol" | "search" | "soon";

export type RecordTypeConfig = {
  /** Etiqueta plural para listas y chips (ej. "Inmuebles"). */
  label: string;
  /** Etiqueta singular para cabeceras de detalle (ej. "Inmueble"). */
  singular: string;
  /** Color de acento del tipo. */
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Si el tipo está implementado de extremo a extremo (lectura/lista). */
  enabled: boolean;
  /** Cómo se añade un registro de este tipo. */
  addMode: AddMode;
  /** Placeholder del input al añadir (según addMode). */
  addPlaceholder: string;
};

export const RECORD_TYPE_CONFIG: Record<RecordType, RecordTypeConfig> = {
  property: { label: "Inmuebles",  singular: "Inmueble",  color: "#3A5F8A", icon: "home-outline",         enabled: true,  addMode: "url",    addPlaceholder: "https://www.idealista.com/…" },
  renting:  { label: "Alquiler",   singular: "Alquiler",  color: "#7A5BA6", icon: "key-outline",          enabled: false, addMode: "soon",   addPlaceholder: "" },
  holiday:  { label: "Vacaciones", singular: "Vacación",  color: "#2C7A8A", icon: "airplane-outline",     enabled: false, addMode: "soon",   addPlaceholder: "" },
  crypto:   { label: "Criptos",    singular: "Cripto",    color: "#B87333", icon: "logo-bitcoin",         enabled: true,  addMode: "symbol", addPlaceholder: "BTC, ETH, SOL…" },
  market:   { label: "Markets",    singular: "Mercado",   color: "#2D6A4F", icon: "trending-up-outline",  enabled: false, addMode: "soon",   addPlaceholder: "" },
  job:      { label: "Empleos",    singular: "Empleo",    color: "#A86A17", icon: "briefcase-outline",    enabled: true,  addMode: "search", addPlaceholder: "Puesto (ej. React developer)" },
  workout:  { label: "Entrenos",   singular: "Producto",  color: "#A23E3E", icon: "barbell-outline",      enabled: false, addMode: "soon",   addPlaceholder: "" },
  chat:     { label: "Chat",       singular: "Chat",      color: "#3A7BD5", icon: "chatbubbles-outline",  enabled: false, addMode: "soon",   addPlaceholder: "" },
};

export function recordTypeConfig(type: RecordType): RecordTypeConfig {
  return RECORD_TYPE_CONFIG[type];
}
