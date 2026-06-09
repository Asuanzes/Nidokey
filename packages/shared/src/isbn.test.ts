/**
 * Tests de validación de ISBN con checksum.
 * Ejecutar:  node --import tsx --test packages/shared/src/isbn.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidIsbn10, isValidIsbn13, isValidIsbn, isbn10To13 } from "./isbn";

test("ISBN-13 válidos (checksum ok)", () => {
  assert.equal(isValidIsbn13("9788499926223"), true); // Sapiens (ES)
  assert.equal(isValidIsbn13("9780140328721"), true); // Matilda
  assert.equal(isValidIsbn13("9791035802639"), true); // prefijo 979
});

test("ISBN-13 con formato correcto pero checksum inválido → false", () => {
  assert.equal(isValidIsbn13("9788499926224"), false); // último dígito alterado
  assert.equal(isValidIsbn13("9780000000001"), false);
});

test("ISBN-13 con formato incorrecto → false", () => {
  assert.equal(isValidIsbn13("1234567890123"), false); // no empieza por 978/979
  assert.equal(isValidIsbn13("97884999262"), false); // corto
  assert.equal(isValidIsbn13(""), false);
});

test("ISBN-10 válidos (checksum ok, incluida X)", () => {
  assert.equal(isValidIsbn10("0140328726"), true); // Matilda
  assert.equal(isValidIsbn10("097522980X"), true); // check digit X
});

test("ISBN-10 inválidos → false", () => {
  assert.equal(isValidIsbn10("0140328727"), false); // checksum roto
  assert.equal(isValidIsbn10("12345"), false);
  assert.equal(isValidIsbn10("B0ABC1234X"), false); // ASIN de Kindle, no ISBN
});

test("isValidIsbn acepta ambos formatos", () => {
  assert.equal(isValidIsbn("9788499926223"), true);
  assert.equal(isValidIsbn("0140328726"), true);
  assert.equal(isValidIsbn("0140328727"), false);
});

test("isbn10To13 convierte con el checksum recalculado", () => {
  assert.equal(isbn10To13("0140328726"), "9780140328721");
});
