/**
 * Formateo numérico y fechas. Usa Intl (disponible en Node y RN/Hermes).
 *
 * i18n: el locale activo es un estado de MÓDULO que la app fija al cambiar de
 * idioma (`setFormattingLocale`), así estos formateadores (puros, sin React) se
 * adaptan sin tener que pasar el locale en cada llamada. Cada formateador admite
 * además un `locale` explícito como override puntual. La moneda sigue siendo por
 * registro (cripto/mercado/viaje/empleo llevan su `currency`).
 */

let currentLocale = "es-ES";

/** Fija el locale BCP-47 activo (ej. "es-ES", "en-US"). Lo llama la capa i18n. */
export function setFormattingLocale(locale: string): void {
  if (locale && typeof locale === "string") currentLocale = locale;
}

/** Locale activo (por si alguien necesita leerlo). */
export function getFormattingLocale(): string {
  return currentLocale;
}

export function formatPrice(cents: number | null | undefined, locale?: string): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(locale ?? currentLocale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Formatea un valor en céntimos con su moneda (EUR, USD, …). Generaliza
 * formatPrice para records no inmobiliarios (cripto, mercados…). Muestra 2
 * decimales (estándar de divisa); para inmuebles seguir usando formatPrice
 * (sin decimales).
 */
export function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale?: string
): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(locale ?? currentLocale, {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(cents / 100);
}

export function formatDate(d: Date | string | null | undefined, locale?: string): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale ?? currentLocale, { dateStyle: "medium" }).format(new Date(d));
}
