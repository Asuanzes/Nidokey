/**
 * Formateo numérico y fechas. Usa Intl (disponible en Node y RN).
 */

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

/**
 * Formatea un valor en céntimos con su moneda (EUR, USD, …). Generaliza
 * formatPrice para records no inmobiliarios (cripto, mercados…). Muestra 2
 * decimales (estándar de divisa); para inmuebles seguir usando formatPrice
 * (sin decimales).
 */
export function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined = "EUR"
): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(cents / 100);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(d));
}
