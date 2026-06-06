import { useTranslation } from "react-i18next";
import type { RecordType } from "@nidokey/shared";

/**
 * Etiquetas TRADUCIDAS del tipo de registro ("Inmuebles"/"Properties",
 * "Viaje"/"Trip"…). Las etiquetas viven en `types.<type>.{label,singular}` del
 * JSON i18n; `RECORD_TYPE_CONFIG` (config.ts) mantiene icono/color/addMode.
 */
export function useTypeI18n() {
  const { t } = useTranslation();
  return {
    label: (type: RecordType) => t(`types.${type}.label`),
    singular: (type: RecordType) => t(`types.${type}.singular`),
  };
}
