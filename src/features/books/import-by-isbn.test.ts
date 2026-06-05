/**
 * Tests del servicio importBookByIsbn. Sin red ni BD: mockeamos las dependencias
 * de I/O (lookup por ISBN, upsert, getById).
 *
 * Ejecutar:  node --import tsx --test src/features/books/import-by-isbn.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBook, type Book } from "@nidokey/shared";
import type { BookRecord } from "@prisma/client";

import { importBookByIsbn, type ImportByIsbnDeps } from "./import-by-isbn";

function mockBook(over: Partial<Book> = {}): Book {
  return createBook({
    id: "gb-1",
    source: "GOOGLE_BOOKS",
    title: "Sapiens",
    authors: ["Yuval Noah Harari"],
    isbn13: "9788499926223",
    ...over,
  });
}

function mockRow(over: Partial<BookRecord> = {}): BookRecord {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "book-1",
    ownerId: "u1",
    recordType: "book",
    title: "Sapiens",
    subtitle: "Yuval Noah Harari · 2011",
    status: "WISHLIST",
    authors: "Yuval Noah Harari",
    isbn13: "9788499926223",
    currentValue: 450,
    currency: null,
    imageUrl: "https://img/cover.jpg",
    source: "google_books",
    externalId: "9788499926223",
    lastCheckedAt: now,
    meta: { book: mockBook() },
    createdAt: now,
    updatedAt: now,
    ...over,
  } as unknown as BookRecord;
}

function deps(over: Partial<ImportByIsbnDeps> = {}): ImportByIsbnDeps {
  return {
    lookupByIsbn: async (isbn) => mockBook({ isbn13: isbn }),
    upsert: async () => ({ id: "book-1", created: true, valueChanged: false }),
    getById: async () => mockRow(),
    ...over,
  };
}

test("ISBN válido → importa y devuelve la ficha (created)", async () => {
  const r = await importBookByIsbn("978-84-9992-622-3", "u1", deps());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.status, "created");
    assert.equal(r.record.title, "Sapiens");
    assert.equal(r.record.type, "book");
  }
});

test("ISBN inválido → INVALID_ISBN (sin llamar al lookup)", async () => {
  let called = false;
  const r = await importBookByIsbn(
    "abc123",
    "u1",
    deps({
      lookupByIsbn: async () => {
        called = true;
        return null;
      },
    })
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "INVALID_ISBN");
  assert.equal(called, false);
});

test("ISBN válido pero sin resultados → BOOK_NOT_FOUND", async () => {
  const r = await importBookByIsbn("9788499926223", "u1", deps({ lookupByIsbn: async () => null }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "BOOK_NOT_FOUND");
});

test("re-import del mismo libro → updated", async () => {
  const r = await importBookByIsbn(
    "9788499926223",
    "u1",
    deps({ upsert: async () => ({ id: "book-1", created: false, valueChanged: false }) })
  );
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.status, "updated");
});

test("fallo de lookup (excepción) → METADATA_LOOKUP_FAILED", async () => {
  const r = await importBookByIsbn(
    "9788499926223",
    "u1",
    deps({
      lookupByIsbn: async () => {
        throw new Error("network");
      },
    })
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "METADATA_LOOKUP_FAILED");
});
