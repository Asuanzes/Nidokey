/**
 * Inicialización de i18next + react-i18next para la app móvil.
 *
 * - Fuente de verdad = español (`es`). `fallbackLng: "es"` → si una clave falta
 *   en otro idioma se ve el español, NUNCA la clave cruda (red de seguridad).
 * - Detección del idioma del dispositivo vía Hermes Intl (sin módulo nativo).
 * - El idioma efectivo y la persistencia los gestiona `LanguageProvider`
 *   (language-context.tsx); aquí solo se inicializa con el idioma del dispositivo.
 *
 * Importar este módulo (en `_layout.tsx`) inicializa i18next globalmente; con
 * `initReactI18next` no hace falta envolver con <I18nextProvider>.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { setFormattingLocale } from "@nidokey/shared";
import es from "@/locales/es/translation.json";
import en from "@/locales/en/translation.json";
import { detectDeviceLang, localeForLang } from "./languages";

export const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

const initial = detectDeviceLang();

void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: "es",
  defaultNS: "translation",
  interpolation: { escapeValue: false }, // React ya escapa
  returnNull: false,
});

// Alinea los formateadores (moneda/fecha/número) con el idioma inicial.
setFormattingLocale(localeForLang(initial));

export default i18n;
