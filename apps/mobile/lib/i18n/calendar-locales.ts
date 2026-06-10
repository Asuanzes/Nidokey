import { LocaleConfig } from "react-native-calendars";
import { useTranslation } from "react-i18next";

/**
 * Locales del calendario (react-native-calendars) para el wizard de Viajes.
 *
 * Los nombres de meses/días NO van al JSON de i18n: son datos lingüísticos con
 * la estructura propia de la librería (arrays posicionales) y el tipado
 * `typeof es` del JSON no los modela bien. Se registran AMBOS locales a nivel
 * de módulo y `useCalendarLocale()` conmuta `defaultLocale` según el idioma
 * activo; el caller debe pasar el código devuelto como `key` del <Calendar>
 * para forzar el remount si el usuario cambia de idioma con el wizard abierto
 * (el Calendar no re-renderiza al mutar defaultLocale).
 */

LocaleConfig.locales.es = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
  today: "Hoy",
};
LocaleConfig.locales.en = {
  monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  monthNamesShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  dayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  dayNamesShort: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
  today: "Today",
};
LocaleConfig.defaultLocale = "es";

export type CalendarLang = "es" | "en";

/** Fija el locale del calendario al idioma activo y lo devuelve (para `key=`). */
export function useCalendarLocale(): CalendarLang {
  const { i18n } = useTranslation();
  const lang: CalendarLang = i18n.language === "en" ? "en" : "es";
  LocaleConfig.defaultLocale = lang;
  return lang;
}

/** Mes corto en minúscula del locale ("2026-07" → "jul"/"Jul"). Para fmtDay. */
export function shortMonth(lang: CalendarLang, monthIndex1: number): string {
  const arr = LocaleConfig.locales[lang]?.monthNamesShort ?? [];
  const m = arr[Math.max(0, Math.min(11, monthIndex1 - 1))] ?? "";
  return lang === "es" ? m.toLowerCase() : m;
}
