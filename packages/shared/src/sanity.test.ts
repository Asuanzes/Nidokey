/**
 * Tests de validadores de cordura.
 * Ejecutar:  node --import tsx --test packages/shared/src/sanity.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidPriceEur, isValidMonthlyRentEur, isReasonablePriceChange } from "./sanity";

test("isValidMonthlyRentEur acepta rentas plausibles (euros)", () => {
  assert.equal(isValidMonthlyRentEur(450), true); // habitación/piso barato
  assert.equal(isValidMonthlyRentEur(612), true);
  assert.equal(isValidMonthlyRentEur(2500), true);
  assert.equal(isValidMonthlyRentEur(100), true); // límite inferior
  assert.equal(isValidMonthlyRentEur(50_000), true); // límite superior (local de lujo)
});

test("isValidMonthlyRentEur rechaza fuera de banda y basura", () => {
  assert.equal(isValidMonthlyRentEur(99), false);
  assert.equal(isValidMonthlyRentEur(50_001), false);
  assert.equal(isValidMonthlyRentEur(0), false);
  assert.equal(isValidMonthlyRentEur(null), false);
  assert.equal(isValidMonthlyRentEur(undefined), false);
  assert.equal(isValidMonthlyRentEur(NaN), false);
});

test("una renta típica NO pasa como precio de venta (bandas separadas)", () => {
  // 850 €/mes: válido como renta, pero isValidPriceEur (≥ 10.000 €) lo rechaza
  // como venta → no se puede colar una renta en currentPrice por accidente.
  assert.equal(isValidMonthlyRentEur(850), true);
  assert.equal(isValidPriceEur(850), false);
});

test("isReasonablePriceChange aplica igual a rentas (banda 0,5x–2x)", () => {
  // mismas reglas: una renta que se duplica de golpe es sospechosa
  assert.equal(isReasonablePriceChange(85_000, 90_000).ok, true); // 850→900 €/mes (céntimos)
  assert.equal(isReasonablePriceChange(85_000, 200_000).ok, false); // 850→2000 €/mes
});
