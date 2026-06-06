/**
 * Tests del motor de duplicados (puro, sin red ni Prisma).
 * Ejecutar:  node --import tsx --test packages/shared/src/dedup.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findDuplicateGroups,
  dismissPairKey,
  normalizeForMatch,
  type DedupCandidate,
} from "./dedup";

function book(id: string, over: Partial<DedupCandidate["keys"]> & { title?: string } = {}): DedupCandidate {
  const { title, ...keys } = over;
  return { id, type: "book", title: title ?? "Cien años de soledad", keys: { authors: ["Gabriel García Márquez"], language: "es", ...keys } };
}

test("normalizeForMatch quita acentos/puntuación pero conserva stopwords", () => {
  assert.equal(normalizeForMatch("La Casa de los Espíritus"), "la casa de los espiritus");
});

test("libros: ediciones de distinto año (mismo título+autor) se agrupan", () => {
  const groups = findDuplicateGroups([
    book("a", { isbn13: "9788437604947" }),
    book("b", { isbn13: "9780307474728" }), // ISBN distinto (otra edición)
    book("c", { isbn13: null }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(new Set(groups[0].ids), new Set(["a", "b", "c"]));
  assert.ok(groups[0].score >= 65);
});

test("libros: mismo ISBN-13 (dos proveedores) → 100", () => {
  const groups = findDuplicateGroups([
    book("a", { isbn13: "9788437604947" }),
    book("b", { isbn13: "9788437604947", title: "Cien Años de Soledad" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].score, 100);
  assert.ok(groups[0].reasons.includes("Mismo ISBN"));
});

test("libros: misma obra (workId) y MISMO idioma agrupa aunque difiera el título", () => {
  const groups = findDuplicateGroups([
    book("a", { workId: "OL45804W", title: "Cien años de soledad" }),
    book("b", { workId: "OL45804W", title: "Cien años de soledad (edición conmemorativa)" }),
  ]);
  assert.equal(groups.length, 1);
  assert.ok(groups[0].reasons.includes("Misma obra (Open Library)"));
});

test("libros: gate de idioma manda — misma obra/traducción en idioma distinto NO agrupa", () => {
  // El usuario lee en español y puede querer original + traducción por separado.
  const groups = findDuplicateGroups([
    book("a", { workId: "OL45804W", language: "es", title: "Cien años de soledad" }),
    book("b", { workId: "OL45804W", language: "en", title: "One Hundred Years of Solitude" }),
  ]);
  assert.equal(groups.length, 0);
});

test("libros: distinto título y autor → no agrupa", () => {
  const groups = findDuplicateGroups([
    book("a", { title: "El amor en los tiempos del cólera" }),
    book("b", { title: "Rayuela", authors: ["Julio Cortázar"] }),
  ]);
  assert.equal(groups.length, 0);
});

test("libros: tres novelas DISTINTAS del mismo autor NO se agrupan (sin transitividad)", () => {
  const groups = findDuplicateGroups([
    book("a", { title: "El amor en los tiempos del cólera" }),
    book("b", { title: "Cien años de soledad" }),
    book("c", { title: "Crónica de una muerte anunciada" }),
  ]);
  assert.equal(groups.length, 0);
});

test("libros: distinto autor que comparte UN apellido común no agrupa (tier débil)", () => {
  const groups = findDuplicateGroups([
    book("a", { title: "La casa de Bernarda Alba", authors: ["Federico García Lorca"] }),
    book("b", { title: "La casa de los espíritus", authors: ["Isabel García Allende"] }),
  ]);
  assert.equal(groups.length, 0);
});

test("par descartado se excluye del grupo", () => {
  const dismissed = new Set([dismissPairKey("a", "b")]);
  const groups = findDuplicateGroups(
    [book("a", { isbn13: "X" }), book("b", { isbn13: "Y" })],
    { dismissedPairs: dismissed },
  );
  assert.equal(groups.length, 0);
});

test("empleo: misma oferta en dos plataformas (mismo url) agrupa", () => {
  const j = (id: string, over: Partial<DedupCandidate["keys"]> & { title?: string }): DedupCandidate => {
    const { title, ...keys } = over;
    return { id, type: "job", title: title ?? "Frontend Developer", keys };
  };
  const groups = findDuplicateGroups([
    j("a", { url: "https://x.com/123", company: "ACME" }),
    j("b", { url: "https://x.com/123", company: "ACME" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].score, 100);
});

test("cripto: mismo símbolo entre fuentes distintas agrupa", () => {
  const c = (id: string, symbol: string): DedupCandidate => ({ id, type: "crypto", title: "Bitcoin", keys: { symbol } });
  const groups = findDuplicateGroups([c("a", "BTC"), c("b", "btc")]);
  assert.equal(groups.length, 1);
  assert.ok(groups[0].reasons.includes("Mismo símbolo"));
});

test("menos de 2 candidatos → sin grupos", () => {
  assert.deepEqual(findDuplicateGroups([book("a")]), []);
  assert.deepEqual(findDuplicateGroups([]), []);
});
