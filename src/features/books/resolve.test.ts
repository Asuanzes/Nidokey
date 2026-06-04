/**
 * Tests del pipeline de resolución de libros. Sin red: mockeamos las APIs vía la
 * inyección de `deps` en resolveBookFromUrl, y probamos la extracción de pistas
 * con HTML de ejemplo.
 *
 * Ejecutar:  node --import tsx --test src/features/books/resolve.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBook, type Book } from "@nidokey/shared";

import { resolveBookFromUrl, extractBookHintsFromHtml } from "./resolve";

function mockBook(over: Partial<Book> = {}): Book {
  return createBook({ id: "gb-1", source: "GOOGLE_BOOKS", title: "Sapiens", authors: ["Yuval Noah Harari"], ...over });
}

// ── Extracción de pistas ──────────────────────────────────────────────────────

test("extrae isbn/title/authors de JSON-LD schema.org/Book", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Book","name":"Sapiens",
     "isbn":"978-84-9992-622-3","author":{"@type":"Person","name":"Yuval Noah Harari"}}
  </script></head><body></body></html>`;
  const hints = extractBookHintsFromHtml(html);
  assert.equal(hints.isbn, "9788499926223");
  assert.equal(hints.title, "Sapiens");
  assert.deepEqual(hints.authors, ["Yuval Noah Harari"]);
});

test("extrae ISBN por regex del texto como fallback", () => {
  const hints = extractBookHintsFromHtml(`<html><body><p>ISBN: 978-84-9992-622-3</p></body></html>`);
  assert.equal(hints.isbn, "9788499926223");
});

test("extrae título de og:title limpiando el sufijo de tienda", () => {
  const hints = extractBookHintsFromHtml(
    `<html><head><meta property="og:title" content="El nombre del viento | Casa del Libro"></head></html>`,
  );
  assert.equal(hints.title, "El nombre del viento");
  assert.equal(hints.isbn, undefined);
});

test("HTML sin pistas → objeto vacío", () => {
  assert.deepEqual(extractBookHintsFromHtml(`<html><body><h1>Hola</h1></body></html>`), {});
});

// ── Orquestador (mockeando red + APIs) ────────────────────────────────────────

test("caso ideal: ISBN claro → resuelve por isbn", async () => {
  const r = await resolveBookFromUrl("https://tienda.example/libro/sapiens", {
    fetchHtml: async () => "<html/>",
    extractHints: () => ({ isbn: "9788499926223" }),
    lookupByIsbn: async (isbn) => mockBook({ isbn13: isbn }),
    lookupByTitleAuthor: async () => null,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.via, "isbn");
    assert.equal(r.book.title, "Sapiens");
    assert.equal(r.hints.isbn, "9788499926223");
  }
});

test("sin ISBN pero con título+autor → resuelve por title-author", async () => {
  const r = await resolveBookFromUrl("https://tienda.example/x", {
    fetchHtml: async () => "<html/>",
    extractHints: () => ({ title: "Sapiens", authors: ["Yuval Noah Harari"] }),
    lookupByIsbn: async () => null,
    lookupByTitleAuthor: async (title) => mockBook({ title }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.via, "title-author");
});

test("hay pistas pero las APIs no encuentran el libro → BOOK_NOT_FOUND", async () => {
  const r = await resolveBookFromUrl("https://tienda.example/x", {
    fetchHtml: async () => "<html/>",
    extractHints: () => ({ title: "Un libro inexistente xyz" }),
    lookupByIsbn: async () => null,
    lookupByTitleAuthor: async () => null,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "BOOK_NOT_FOUND");
});

test("sin ISBN ni título extraíbles → ISBN_NOT_FOUND", async () => {
  const r = await resolveBookFromUrl("https://tienda.example/x", {
    fetchHtml: async () => "<html/>",
    extractHints: () => ({}),
    lookupByIsbn: async () => null,
    lookupByTitleAuthor: async () => null,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "ISBN_NOT_FOUND");
});

test("fallo de red al descargar → NETWORK_ERROR", async () => {
  const r = await resolveBookFromUrl("https://tienda.example/x", {
    fetchHtml: async () => {
      throw new Error("ETIMEDOUT");
    },
    extractHints: () => ({}),
    lookupByIsbn: async () => null,
    lookupByTitleAuthor: async () => null,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "NETWORK_ERROR");
});

test("URL inválida → INVALID_URL", async () => {
  const r = await resolveBookFromUrl("no-soy-una-url");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "INVALID_URL");
});
