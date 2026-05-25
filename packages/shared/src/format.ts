/**
 * Formateo numérico y fechas. Usa Intl (disponible en Node y RN).
 */

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(d));
}
