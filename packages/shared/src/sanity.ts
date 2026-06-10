/**
 * Validadores de cordura para datos extraídos de portales / scrapers.
 * Centralizamos para que ningún parser produzca basura silenciosa.
 *
 * Puro JS, sin dependencias. Compatible con Node y React Native.
 */

export function isValidPriceEur(n: number | null | undefined): n is number {
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 10000 && n <= 50_000_000;
}

/**
 * Renta mensual de alquiler, en EUROS (misma unidad que isValidPriceEur).
 * Banda 100 €–50.000 €/mes: una renta de 450 € NO debe colarse como "venta de
 * 450 €" (isValidPriceEur la rechazaría al exigir ≥ 10.000 €), por eso es banda
 * propia. Cubre desde habitación barata hasta local/oficina de gama alta.
 */
export function isValidMonthlyRentEur(n: number | null | undefined): n is number {
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 100 && n <= 50_000;
}

export function isValidBuiltArea(n: number | null | undefined): n is number {
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 5 && n <= 5000;
}

export function isValidPlotArea(n: number | null | undefined): n is number {
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 5 && n <= 1_000_000;
}

export function isValidYear(n: number | null | undefined): n is number {
  if (n == null || !Number.isFinite(n)) return false;
  return n >= 1700 && n <= new Date().getFullYear() + 5;
}

export function isReasonablePriceChange(
  prevCents: number | null | undefined,
  newCents: number | null | undefined
): { ok: true } | { ok: false; reason: string } {
  if (prevCents == null || newCents == null) return { ok: true };
  if (prevCents === newCents) return { ok: true };
  const ratio = newCents / prevCents;
  if (ratio < 0.5) {
    return { ok: false, reason: `Precio cayó a ${(ratio * 100).toFixed(0)}% del anterior (sospechoso)` };
  }
  if (ratio > 2) {
    return { ok: false, reason: `Precio multiplicó por ${ratio.toFixed(2)} (sospechoso)` };
  }
  return { ok: true };
}
