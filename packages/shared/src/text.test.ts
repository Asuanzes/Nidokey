/**
 * Tests de limpieza/validación de descripciones.
 * Ejecutar:  node --import tsx --test packages/shared/src/text.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanDescription, isLikelyJunkDescription } from "./text";

test("cleanDescription quita tags, entidades y normaliza", () => {
  const raw = "<p>Piso&nbsp;reformado</p>\n\n<br>con  terraza &amp; garaje.";
  assert.equal(cleanDescription(raw), "Piso reformado con terraza & garaje.");
});

test("cleanDescription decodifica entidades numéricas (acentos)", () => {
  assert.equal(cleanDescription("&#193;tico luminoso, &#xe1;mplio"), "Ático luminoso, ámplio");
});

test("cleanDescription recorta en frontera de palabra con elipsis", () => {
  const long = "palabra ".repeat(50).trim(); // 399 chars
  const out = cleanDescription(long, { maxChars: 20 });
  assert.ok(out.length <= 21);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("palabr…")); // cortó en espacio, no a mitad
});

test("cleanDescription vacío/nulo → ''", () => {
  assert.equal(cleanDescription(null), "");
  assert.equal(cleanDescription("   <br> "), "");
});

test("isLikelyJunkDescription: basura típica → true", () => {
  assert.equal(isLikelyJunkDescription("Usamos cookies para mejorar tu experiencia. Aceptar y continuar."), true);
  assert.equal(isLikelyJunkDescription("Anuncios similares en la misma zona que te pueden interesar mucho"), true);
  assert.equal(isLikelyJunkDescription("+34 600 123 456"), true);
  assert.equal(isLikelyJunkDescription("Contacta ahora para más información"), true); // CTA corto
  assert.equal(isLikelyJunkDescription("Piso bonito"), true); // < 25
});

test("isLikelyJunkDescription: descripción real → false", () => {
  const real =
    "Estupendo piso exterior totalmente reformado en pleno centro, con tres dormitorios, " +
    "cocina equipada y plaza de garaje. Contacta para concertar una visita sin compromiso.";
  assert.equal(isLikelyJunkDescription(cleanDescription(real)), false);
});
