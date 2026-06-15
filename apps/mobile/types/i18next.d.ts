/**
 * Claves de traducción TIPADAS: aumenta i18next con el recurso español (fuente de
 * verdad) como forma canónica. Así `t("clave.inexistente")` es un error de
 * compilación → `tsc` detecta typos y claves que faltan. Al añadir cadenas, se
 * añaden primero a `locales/es/translation.json` y quedan tipadas aquí vía `typeof es`.
 */
import "i18next";
import type es from "@/locales/es/translation.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof es };
  }
}
