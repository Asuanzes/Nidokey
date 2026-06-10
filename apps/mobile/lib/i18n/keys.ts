import type { ParseKeys } from "i18next";

/**
 * Clave de traducción VÁLIDA, tipada contra el JSON español (la fuente de
 * verdad, vía el declaration merging de types/i18next.d.ts). Para configs
 * no-React (tools.ts, etc.) que guardan la CLAVE y dejan que el punto de
 * render la resuelva con t(): un typo en `labelKey` es error de compilación,
 * igual que en t("clave.mala").
 */
export type I18nKey = ParseKeys;
