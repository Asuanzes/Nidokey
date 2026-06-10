/**
 * Tests del alias de chat.
 * Ejecutar:  node --import tsx --test packages/shared/src/username.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeUsername, isValidUsername, usernameError } from "./username";

test("normalizeUsername quita @ y pasa a minúsculas", () => {
  assert.equal(normalizeUsername("@Alejandro"), "alejandro");
  assert.equal(normalizeUsername("  @@JUAN_22 "), "juan_22");
  assert.equal(normalizeUsername(null), "");
});

test("isValidUsername: válidos", () => {
  assert.equal(isValidUsername("alejandro"), true);
  assert.equal(isValidUsername("@juan_22"), true);
  assert.equal(isValidUsername("ab3"), true); // 3 mínimo
});

test("isValidUsername: inválidos", () => {
  assert.equal(isValidUsername("ab"), false); // <3
  assert.equal(isValidUsername("1juan"), false); // empieza por dígito
  assert.equal(isValidUsername("con-guion"), false); // guion no permitido
  assert.equal(isValidUsername("María"), false); // acentos/mayúsculas
  assert.equal(isValidUsername("a".repeat(21)), false); // >20
  assert.equal(isValidUsername("admin"), false); // reservado
});

test("usernameError distingue formato vs reservado", () => {
  assert.equal(usernameError("alejandro"), null);
  assert.equal(usernameError("x"), "format");
  assert.equal(usernameError("soporte"), "reserved");
});
