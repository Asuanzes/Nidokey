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

/**
 * Número COMPACTO (k / M / B) con sufijo opcional. Pensado para cap. de mercado,
 * volumen, etc. en las tarjetas/detalles financieros.
 *   - suffix "EUR" → " €"; cualquier otro string → ese símbolo en mayúsculas;
 *     vacío → sin sufijo.
 *   - null → "—".
 * Nota: usa coma decimal fija (es); el locale completo queda pendiente (igual que
 * estaba en las copias locales de AssetDetail/RecordCard que esto unifica).
 */
export function compactNumber(n: number | null, suffix = ""): string {
  if (n == null) return "—";
  const sym = suffix.toUpperCase() === "EUR" ? " €" : suffix ? ` ${suffix.toUpperCase()}` : "";
  const abs = Math.abs(n);
  const fmt = (x: number) => x.toFixed(x >= 100 ? 0 : 1).replace(".", ",");
  if (abs >= 1e9) return `${fmt(n / 1e9)} B${sym}`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M${sym}`;
  if (abs >= 1e3) return `${fmt(n / 1e3)} k${sym}`;
  return `${Math.round(n)}${sym}`;
}

/**
 * Quita los tokens de enlace a registros ([[tipo:id|Título]]) que el asistente
 * Nidokey inserta en sus mensajes, dejando solo el Título. Para previews de la
 * lista de chats y notificaciones push, donde NO se linkifica: nunca debe verse
 * el código. En el chat abierto sí se renderiza como enlace pulsable.
 */
export function stripRecordLinks(text: string): string {
  return text
    .replace(/\[\[[a-z]+:[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[[a-z]+:[^\]]+\]\]/g, "");
}
