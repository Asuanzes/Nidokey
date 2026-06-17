/**
 * Test de stripRecordLinks (limpieza de tokens [[tipo:id|Título]] en previews).
 * Ejecutar:  node --import tsx --test packages/shared/src/strip-record-links.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { stripRecordLinks } from "./format";

test("deja solo el Título del token", () => {
  assert.equal(stripRecordLinks("Mira [[crypto:cmqii123|Bitcoin]]"), "Mira Bitcoin");
  assert.equal(
    stripRecordLinks("[[property:abc|Piso en Oviedo]] y [[book:x9|Sapiens]]"),
    "Piso en Oviedo y Sapiens",
  );
});

test("token sin título se elimina; texto normal intacto", () => {
  assert.equal(stripRecordLinks("antes [[crypto:abc]] después"), "antes  después");
  assert.equal(stripRecordLinks("sin tokens aquí"), "sin tokens aquí");
});

test("token de navegación [[ir:/ruta|Etiqueta]] -> Etiqueta", () => {
  assert.equal(stripRecordLinks("Abre [[ir:/food/cart|el carrito]]"), "Abre el carrito");
});
