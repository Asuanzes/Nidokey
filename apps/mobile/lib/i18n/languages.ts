/**
 * Registro de idiomas de la app. Añadir un idioma = soltar su JSON en
 * `apps/mobile/locales/<code>/translation.json`, registrarlo en `resources`
 * (lib/i18n/index.ts) y añadir una entrada aquí. El selector de Ajustes lee de
 * `LANGUAGES`.
 *
 * RTL: el campo `isRTL` queda preparado para árabe/hebreo, pero el trabajo de
 * layout RTL está APLAZADO (no hay idiomas RTL activos todavía).
 */

/** Códigos de idioma soportados (con traducción real). */
export type AppLang = "es" | "en";

export const SUPPORTED: AppLang[] = ["es", "en"];

export interface LanguageOption {
  /** Código de app/i18next ("es", "en"). */
  code: AppLang;
  /** Locale BCP-47 para Intl (moneda/fecha/número): "es-ES", "en-US". */
  bcp47: string;
  /** Nombre en su propio idioma ("Español", "English"). */
  nameNative: string;
  /** Nombre en inglés ("Spanish", "English"). */
  nameEnglish: string;
  flag: string;
  isRTL: boolean;
  translationQuality: "native" | "automatic" | "partial";
}

export const LANGUAGES: LanguageOption[] = [
  { code: "es", bcp47: "es-ES", nameNative: "Español", nameEnglish: "Spanish", flag: "🇪🇸", isRTL: false, translationQuality: "native" },
  { code: "en", bcp47: "en-US", nameNative: "English", nameEnglish: "English", flag: "🇬🇧", isRTL: false, translationQuality: "native" },
];

/** Locale BCP-47 para un idioma de app (fallback es-ES). */
export function localeForLang(lang: AppLang): string {
  return LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? "es-ES";
}

/**
 * Idioma del DISPOSITIVO vía Hermes Intl (sin módulo nativo → no exige recompilar
 * el dev client). `Intl.DateTimeFormat().resolvedOptions().locale` → "es-ES" →
 * "es". Si no está soportado, cae a español (idioma fuente).
 */
export function detectDeviceLang(): AppLang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || "es";
    const base = loc.split("-")[0]!.toLowerCase();
    return (SUPPORTED as string[]).includes(base) ? (base as AppLang) : "es";
  } catch {
    return "es";
  }
}
