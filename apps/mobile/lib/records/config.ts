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
 *  - "symbol": teclear un símbolo → fetch server-side por API (cripto).
 *  - "search": teclear nombre/ticker → buscar y elegir de una lista (mercados).
 *  - "wizard": asistente multi-paso en pantalla propia (viajes).
 *  - "soon":   aún no disponible (se muestra "Próximamente").
 */
export type AddMode = "url" | "symbol" | "search" | "soon" | "wizard";

export type RecordTypeConfig = {
  /** Color de acento del tipo (sobre fondo claro). */
  color: string;
  /** Variante aclarada para legibilidad como glifo/texto sobre fondo oscuro
   *  (#262320). Si falta, se usa `color`. Resuélvelo con `categoryColor(type, dark)`.
   *  Para FONDOS rellenos con texto blanco usa `color` (no esta variante). */
  colorDark?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Si el tipo está implementado de extremo a extremo (lectura/lista). */
  enabled: boolean;
  /** Cómo se añade un registro de este tipo. */
  addMode: AddMode;
  /**
   * En addMode "search": si true, busca solo al pulsar (no en vivo al teclear).
   * Para fuentes de PAGO (empleo/Apify) cada búsqueda cuesta → evita gastar
   * crédito en cada pausa de escritura. Mercados (Yahoo, gratis) lo deja en vivo.
   */
  searchOnSubmit?: boolean;
};

// Etiquetas y placeholders viven en i18n: `types.{type}.label/singular`
// (useTypeI18n) y `types.{type}.placeholder` — aquí solo lo NO traducible
// (color/icono/modo). Los campos legacy label/singular/addPlaceholder se
// eliminaron al extraer i18n.
export const RECORD_TYPE_CONFIG: Record<RecordType, RecordTypeConfig> = {
  property: { color: "#3A5F8A", colorDark: "#6E93C0", icon: "home-outline",        enabled: true,  addMode: "url" },
  holiday:  { color: "#2C7A8A", colorDark: "#5FAEBE", icon: "airplane-outline",    enabled: true,  addMode: "wizard" },
  crypto:   { color: "#B5893B", colorDark: "#D4A95A", icon: "logo-bitcoin",        enabled: true,  addMode: "symbol" },
  market:   { color: "#2D6A4F", colorDark: "#5FA383", icon: "trending-up-outline", enabled: true,  addMode: "search" },
  job:      { color: "#A86A17", colorDark: "#D29A4A", icon: "briefcase-outline",   enabled: true,  addMode: "search", searchOnSubmit: true },
  workout:  { color: "#A23E3E", colorDark: "#CF7059", icon: "barbell-outline",     enabled: false, addMode: "soon" },
  chat:     { color: "#6C5A9C", colorDark: "#8B79C4", icon: "chatbubbles-outline", enabled: false, addMode: "soon" },
  book:     { color: "#8C4A52", colorDark: "#B86575", icon: "book-outline",        enabled: true,  addMode: "search", searchOnSubmit: true },
};

export function recordTypeConfig(type: RecordType): RecordTypeConfig {
  return RECORD_TYPE_CONFIG[type];
}

/**
 * Color de acento del tipo resuelto para el tema activo. En oscuro usa
 * `colorDark` (aclarado para legibilidad de glifo/texto sobre #262320); en claro
 * usa `color`. Para FONDOS rellenos con texto blanco usa `color` directamente
 * (la variante clara empeoraría el contraste del texto blanco).
 */
export function categoryColor(type: RecordType, dark: boolean): string {
  const cfg = RECORD_TYPE_CONFIG[type];
  return dark && cfg.colorDark ? cfg.colorDark : cfg.color;
}
