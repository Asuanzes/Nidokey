import { test } from "node:test";
import assert from "node:assert/strict";
import { trendToQuery } from "./normalize";

test("trendToQuery quita almohadilla, separa camelCase y colapsa espacios", () => {
  assert.equal(trendToQuery("#FelizLunes Asturias"), "Feliz Lunes Asturias");
  assert.equal(trendToQuery("  #OpenAI_News-Update  "), "Open AI News Update");
});

