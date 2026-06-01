import type { Ionicons } from "@expo/vector-icons";
import type { RecordType } from "@nidokey/shared";

/**
 * Herramientas contextuales por categoría (el "menú lateral / panel contextual"
 * que aparece DENTRO de un registro). Config-driven: añadir una categoría o una
 * herramienta = añadir una entrada aquí; el `CategoryContextSheet` y el dispatch
 * de la pantalla de detalle leen de esto, sin reescribir UI.
 *
 * `kind` decide el comportamiento (lo resuelve el dispatcher por `id`, ver
 * `app/property/[id].tsx`):
 *  - "action": ejecuta algo (re-check, etc.) y muestra feedback.
 *  - "route":  navega a una sub-pantalla (simulador, placeholders).
 *  - "info":   muestra información (puede ser una ruta o un aviso).
 *  - "share":  abre el diálogo de compartir nativo.
 *
 * `enabled: false` ⇒ se muestra atenuada como "Próximamente".
 */
export type ToolKind = "action" | "route" | "info" | "share";

export type ToolDef = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: ToolKind;
  enabled: boolean;
  /** Texto auxiliar (p. ej. "Próximamente" en herramientas deshabilitadas). */
  hint?: string;
};

const PROPERTY_TOOLS: ToolDef[] = [
  { id: "recheck", label: "Actualizar precio", icon: "refresh-outline", kind: "action", enabled: true, hint: "Re-consulta los anuncios" },
  { id: "mortgage", label: "Simulador de hipoteca", icon: "calculator-outline", kind: "route", enabled: true, hint: "Cuota y amortización" },
  { id: "catastro", label: "Catastro", icon: "document-text-outline", kind: "route", enabled: true, hint: "Referencia y datos OVC" },
  { id: "registro", label: "Registro de la Propiedad", icon: "ribbon-outline", kind: "route", enabled: true, hint: "Titularidad y cargas" },
  { id: "ine", label: "Estadísticas de zona", icon: "bar-chart-outline", kind: "route", enabled: true, hint: "Precios y renta (INE)" },
  { id: "share", label: "Compartir", icon: "share-outline", kind: "share", enabled: true },
];

const CRYPTO_TOOLS: ToolDef[] = [
  { id: "alert", label: "Alerta de precio", icon: "notifications-outline", kind: "info", enabled: false, hint: "Próximamente" },
  { id: "news", label: "Noticias (tendencias)", icon: "newspaper-outline", kind: "info", enabled: false, hint: "Próximamente" },
  { id: "share", label: "Compartir", icon: "share-outline", kind: "share", enabled: true },
];

const RECORD_TOOLS: Partial<Record<RecordType, ToolDef[]>> = {
  property: PROPERTY_TOOLS,
  crypto: CRYPTO_TOOLS,
};

export function toolsForType(type: RecordType): ToolDef[] {
  return RECORD_TOOLS[type] ?? [];
}
