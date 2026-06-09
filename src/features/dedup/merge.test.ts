/**
 * Tests de la fusión por-campo de libros (fillBook, puro — sin Prisma).
 * Caso B6 (Fnac): conservar la ficha de una fuente pobre no debe perder los
 * datos que solo tenía la otra (autor, rating, sinopsis…), y NUNCA degradar.
 * Ejecutar:  node --import tsx --test src/features/dedup/merge.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBook } from "@nidokey/shared";

import { fillBook } from "./merge";

test("fillBook: el keep pobre (Fnac) hereda autor/rating/sinopsis del donante sin degradar", () => {
  const fnac = createBook({
    id: "isbn:9788499926223",
    source: "MANUAL",
    title: "Sapiens",
    isbn13: "9788499926223",
    publisher: "Debate",
  });
  const google = createBook({
    id: "gbooks:abc",
    source: "GOOGLE_BOOKS",
    title: "Sapiens: De animales a dioses",
    authors: ["Yuval Noah Harari"],
    description: "Una breve historia de la humanidad.",
    averageRating: 4.4,
    ratingsCount: 1200,
    publishedYear: 2014,
    detailUrl: "https://books.google.es/books?id=abc",
  });

  const merged = fillBook(fnac, [google]);
  assert.ok(merged);
  // Heredado del donante (el keep no lo tenía):
  assert.deepEqual(merged.authors, ["Yuval Noah Harari"]);
  assert.equal(merged.description, "Una breve historia de la humanidad.");
  assert.equal(merged.averageRating, 4.4);
  assert.equal(merged.publishedYear, 2014);
  assert.equal(merged.detailUrl, "https://books.google.es/books?id=abc");
  // Conservado del keep (no degrada):
  assert.equal(merged.title, "Sapiens");
  assert.equal(merged.publisher, "Debate");
  assert.equal(merged.isbn13, "9788499926223");
});

test("fillBook: no pisa valores existentes del keep aunque el donante difiera", () => {
  const keep = createBook({
    id: "a",
    source: "GOOGLE_BOOKS",
    title: "Rayuela",
    authors: ["Julio Cortázar"],
    description: "Sinopsis original.",
    averageRating: 4.1,
  });
  const donor = createBook({
    id: "b",
    source: "OPEN_LIBRARY",
    title: "Rayuela (otra edición)",
    authors: ["J. Cortázar"],
    description: "Otra sinopsis.",
    averageRating: 3.0,
  });
  const merged = fillBook(keep, [donor]);
  assert.ok(merged);
  assert.deepEqual(merged.authors, ["Julio Cortázar"]);
  assert.equal(merged.description, "Sinopsis original.");
  assert.equal(merged.averageRating, 4.1);
});

test("fillBook: externalIds se unen con prioridad del keep", () => {
  const keep = createBook({
    id: "a",
    source: "GOOGLE_BOOKS",
    title: "X",
    externalIds: { googleVolumeId: "g1" },
  });
  const donor = createBook({
    id: "b",
    source: "OPEN_LIBRARY",
    title: "X",
    externalIds: { googleVolumeId: "g2", openLibraryWorkId: "OL1W" },
  });
  const merged = fillBook(keep, [donor]);
  assert.ok(merged);
  assert.equal(merged.externalIds.googleVolumeId, "g1"); // keep manda
  assert.equal(merged.externalIds.openLibraryWorkId, "OL1W"); // hueco rellenado
});

test("fillBook: sin base devuelve el primer donante", () => {
  const donor = createBook({ id: "b", source: "OPEN_LIBRARY", title: "X" });
  assert.equal(fillBook(undefined, [undefined, donor]), donor);
});
