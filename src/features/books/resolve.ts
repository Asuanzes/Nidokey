import * as cheerio from "cheerio";
import { fromGoogleBooks, fromOpenLibrary, type Book } from "@nidokey/shared";

import { googleBooksSearch } from "@/features/sources/providers/google-books";
import {
  openLibrarySearch,
  openLibraryWorkDescription,
} from "@/features/sources/providers/open-library";
import type { NormalizedRecord } from "@/features/sources/types";
import type { BookHints, ResolveResult } from "./types";

/**
 * Pipeline robusto de importación de LIBROS desde una URL.
 *
 *   resolveBookFromUrl(url)
 *     A) fetchPageHtml(url)                → HTML (la página es solo una PISTA)
 *     B) extractBookHintsFromHtml(html)    → { isbn?, title?, authors? }
 *        - JSON-LD schema.org/Book·Product (primario)
 *        - microdata itemprop, meta tags, regex de ISBN (fallbacks)
 *     C) si hay ISBN → lookupBookByIsbn   (Google Books → Open Library, match exacto)
 *        si no       → lookupBookByTitleAuthor (búsqueda + scoring fuzzy)
 *     D) Normaliza al modelo de dominio `Book` (lo hacen fromGoogleBooks/OL)
 *     E) Devuelve ResolveResult (ok+book | error tipado)
 *
 * Sin reglas por dominio: nos apoyamos en datos estructurados + APIs de
 * metadatos. Donde se podría enchufar un LLM en el futuro: en `pickBest` para
 * desambiguar candidatos cuando el scoring por título+autor es flojo (ver nota).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Paso A — descargar el HTML ────────────────────────────────────────────────

/** Descarga el HTML de la página. Lanza en fallo de red/HTTP (lo captura el
 *  orquestador → NETWORK_ERROR). Mínimo y genérico: no toca cabeceras por sitio. */
export async function fetchPageHtml(url: string, timeoutMs = 12000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Paso B — extraer pistas del HTML ──────────────────────────────────────────

/** Extrae { isbn?, title?, authors? } de la página. Prioriza datos
 *  estructurados (schema.org/Book) y cae a meta tags y regex de ISBN. */
export function extractBookHintsFromHtml(html: string): BookHints {
  const hints: BookHints = {};
  let $: ReturnType<typeof cheerio.load>;
  try {
    $ = cheerio.load(html);
  } catch {
    const i = isbnFromText(html);
    return i ? { isbn: i } : {};
  }

  // 1) JSON-LD schema.org/Book | Product (la señal primaria).
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of flattenJsonLd(data)) {
      const type = jsonLdType(node);
      if (!(type.includes("book") || type.includes("product"))) continue;
      if (!hints.isbn) {
        const i = normalizeIsbn(firstString(node.isbn ?? node.gtin13 ?? node.gtin ?? node.gtin14));
        if (i) hints.isbn = i;
      }
      if (!hints.title && typeof node.name === "string") {
        const t = cleanTitle(node.name);
        if (t.length >= 2) hints.title = t;
      }
      if (!hints.authors) {
        const a = parseAuthors(node.author);
        if (a.length) hints.authors = a;
      }
    }
  });

  // 2) Microdata schema.org/Book.
  if (!hints.isbn) {
    const mi = $('[itemprop="isbn"]').attr("content") ?? $('[itemprop="isbn"]').first().text();
    const i = normalizeIsbn(mi);
    if (i) hints.isbn = i;
  }
  if (!hints.title) {
    const mt = $('[itemtype*="schema.org/Book"] [itemprop="name"]').first().text();
    if (mt) {
      const t = cleanTitle(mt);
      if (t.length >= 2) hints.title = t;
    }
  }
  if (!hints.authors) {
    const authors = $('[itemtype*="schema.org/Book"] [itemprop="author"]')
      .map((_, el) => $(el).attr("content") || $(el).text())
      .get()
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .slice(0, 5);
    if (authors.length) hints.authors = authors;
  }

  // 3) Meta tags (book:isbn / og:isbn / product:isbn / og:title).
  if (!hints.isbn) {
    const m =
      $('meta[property="book:isbn"]').attr("content") ??
      $('meta[property="og:isbn"]').attr("content") ??
      $('meta[property="product:isbn"]').attr("content") ??
      $('meta[name="isbn"]').attr("content");
    const i = normalizeIsbn(m);
    if (i) hints.isbn = i;
  }
  if (!hints.title) {
    const og = $('meta[property="og:title"]').attr("content") ?? $("title").first().text();
    if (og) {
      const t = cleanTitle(og);
      if (t.length >= 2) hints.title = t;
    }
  }

  // 4) Último recurso: ISBN-13 por regex en el texto de la página.
  if (!hints.isbn) {
    const i = isbnFromText(html);
    if (i) hints.isbn = i;
  }

  return hints;
}

// ── Paso C — lookups contra APIs de metadatos ─────────────────────────────────

/** Resuelve un libro por ISBN (pivote fiable): Google Books primero (más rico),
 *  Open Library como respaldo keyless. Devuelve el `Book` normalizado o null. */
export async function lookupBookByIsbn(isbn: string): Promise<Book | null> {
  const norm = normalizeIsbn(isbn);
  if (!norm) return null;
  let book: Book | null = null;
  try {
    const items = await googleBooksSearch(`isbn:${norm}`);
    if (items[0]) book = fromGoogleBooks(items[0]);
  } catch {
    /* Google caído → probamos OL */
  }
  if (!book) {
    try {
      const docs = await openLibrarySearch(norm);
      if (docs[0]) book = await enrichOl(fromOpenLibrary(docs[0]));
    } catch {
      /* OL caído → null */
    }
  }
  return book ? withIsbnCoverFallback(book, norm) : null;
}

/** Muchas ediciones concretas de Google Books (las que casan por ISBN exacto) NO
 *  traen portada, aunque la obra sí tenga una. Si el libro resuelto se queda sin
 *  portada, usamos la portada por ISBN de Open Library (URL directa, sin API key).
 *  `?default=false` → 404 si OL tampoco la tiene (expo-image muestra su placeholder). */
function withIsbnCoverFallback(book: Book, isbn: string): Book {
  if (book.imageUrls.thumbnail || book.imageUrls.large) return book;
  return {
    ...book,
    imageUrls: {
      thumbnail: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
      large: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    },
  };
}

/** Resuelve por título(+autor) cuando no hay ISBN: busca en Google Books / Open
 *  Library y elige el mejor candidato por similitud de título y solape de autor.
 *  Devuelve null si ninguno supera el umbral (evita "añadir el que sea"). */
export async function lookupBookByTitleAuthor(
  title: string,
  authors: string[],
): Promise<Book | null> {
  const q = [title, authors[0]].filter(Boolean).join(" ").trim();
  if (q.length < 2) return null;
  try {
    const items = await googleBooksSearch(q);
    const best = pickBest(items.map(fromGoogleBooks), title, authors);
    if (best) return best;
  } catch {
    /* Google caído → probamos OL */
  }
  try {
    const docs = await openLibrarySearch(q);
    const best = pickBest(docs.map(fromOpenLibrary), title, authors);
    if (best) return enrichOl(best);
  } catch {
    /* OL caído → null */
  }
  return null;
}

// ── Orquestador (inyectable para tests) ───────────────────────────────────────

export interface ResolveDeps {
  fetchHtml: typeof fetchPageHtml;
  extractHints: typeof extractBookHintsFromHtml;
  lookupByIsbn: typeof lookupBookByIsbn;
  lookupByTitleAuthor: typeof lookupBookByTitleAuthor;
}

const defaultDeps: ResolveDeps = {
  fetchHtml: fetchPageHtml,
  extractHints: extractBookHintsFromHtml,
  lookupByIsbn: lookupBookByIsbn,
  lookupByTitleAuthor: lookupBookByTitleAuthor,
};

/**
 * Orquesta A→E. `deps` se inyecta en tests para mockear red/APIs.
 * Devuelve un resultado etiquetado: `{ ok:true, book, via, hints }` o
 * `{ ok:false, code, message }`.
 */
export async function resolveBookFromUrl(
  url: string,
  deps: Partial<ResolveDeps> = {},
): Promise<ResolveResult> {
  const d = { ...defaultDeps, ...deps };

  if (!isHttpUrl(url)) {
    return { ok: false, code: "INVALID_URL", message: "La URL no es válida." };
  }

  let html: string;
  try {
    html = await d.fetchHtml(url);
  } catch (e) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: e instanceof Error ? `No se pudo abrir la página: ${e.message}` : "Fallo de red.",
    };
  }

  const hints = d.extractHints(html);

  // C1) ISBN → pivote fiable.
  if (hints.isbn) {
    const book = await d.lookupByIsbn(hints.isbn);
    if (book) return { ok: true, book, via: "isbn", hints };
  }

  // C2) Título(+autor) → fuzzy con scoring.
  if (hints.title) {
    const book = await d.lookupByTitleAuthor(hints.title, hints.authors ?? []);
    if (book) return { ok: true, book, via: "title-author", hints };
  }

  if (!hints.isbn && !hints.title) {
    return {
      ok: false,
      code: "ISBN_NOT_FOUND",
      message: "No se pudo extraer ISBN ni título de la página.",
    };
  }
  return {
    ok: false,
    code: "BOOK_NOT_FOUND",
    message: "Libro no encontrado en Google Books ni Open Library.",
  };
}

// ── Mapeo a NormalizedRecord (para guardar vía upsertRecord / import) ──────────

/** Proyecta un `Book` resuelto a NormalizedRecord (la fila que persiste la app).
 *  La fuente se deriva del propio libro; el `Book` entero viaja en `meta.book`. */
export function bookToNormalized(book: Book): NormalizedRecord {
  const source =
    book.source === "OPEN_LIBRARY"
      ? "open_library"
      : book.source === "MANUAL"
      ? "manual"
      : "google_books";
  const externalId =
    book.isbn13 ??
    book.externalIds?.googleVolumeId ??
    book.externalIds?.openLibraryWorkId ??
    book.id;
  const author = book.authors[0] ?? null;
  return {
    recordType: "book",
    title: book.title || "Libro",
    subtitle: [author, book.publishedYear].filter(Boolean).join(" · ") || null,
    status: "WISHLIST",
    currentValue: book.averageRating != null ? Math.round(book.averageRating * 100) : null,
    currency: null,
    imageUrl: book.imageUrls.thumbnail ?? book.imageUrls.large ?? null,
    source,
    externalId,
    observedAt: new Date(),
    meta: { book, authors: book.authors.join(", "), isbn13: book.isbn13 ?? null },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type JsonNode = Record<string, unknown>;

function flattenJsonLd(data: unknown): JsonNode[] {
  const out: JsonNode[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    const node = v as JsonNode;
    out.push(node);
    if (Array.isArray(node["@graph"])) (node["@graph"] as unknown[]).forEach(visit);
  };
  visit(data);
  return out;
}

function jsonLdType(node: JsonNode): string {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase();
  if (Array.isArray(t)) return t.map((x) => String(x)).join(",").toLowerCase();
  return "";
}

function parseAuthors(a: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
    else if (v && typeof v === "object") {
      const name = (v as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
  };
  if (Array.isArray(a)) a.forEach(push);
  else push(a);
  return out.slice(0, 5);
}

function firstString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    const s = v.find((x) => typeof x === "string" || typeof x === "number");
    return s != null ? String(s) : undefined;
  }
  return undefined;
}

/** Normaliza a ISBN-13 o ISBN-10 (solo dígitos / X). null si no es un ISBN. */
export function normalizeIsbn(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(d)) return d; // ISBN-13
  if (/^\d{9}[\dX]$/.test(d)) return d; // ISBN-10
  return null;
}

function isbnFromText(html: string): string | null {
  // "ISBN 978-84-..." o un EAN-13 suelto que empiece por 978/979.
  const m = html.match(/97[89][-\s]?(?:\d[-\s]?){9}\d/);
  return normalizeIsbn(m?.[0] ?? null);
}

function cleanTitle(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  // Sufijo de tienda tras "|" (Fnac, Casa del Libro…) → quédate con lo de antes.
  if (t.includes("|")) t = t.split("|")[0].trim();
  return t.slice(0, 200);
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function enrichOl(book: Book): Promise<Book> {
  if (book.source === "OPEN_LIBRARY" && !book.description && book.externalIds?.openLibraryWorkId) {
    try {
      const d = await openLibraryWorkDescription(book.externalIds.openLibraryWorkId);
      if (d) return { ...book, description: d };
    } catch {
      /* sin sinopsis → seguimos */
    }
  }
  return book;
}

// ── Scoring fuzzy título+autor (sin dependencias; autocontenido) ──────────────
// NOTA: aquí es el punto natural para enchufar un LLM en el futuro — cuando el
// mejor `score` quede en una zona gris (p. ej. 0.35–0.6) o haya empate, pedir a
// un modelo que desambigüe entre los 2–3 candidatos top con título+autor+año.

function pickBest(books: Book[], title: string, authors: string[]): Book | null {
  if (!books.length) return null;
  const tq = bigrams(title);
  const aq = authors.map(normText).filter(Boolean);
  let best: { book: Book; score: number } | null = null;
  for (const b of books) {
    if (!b.title) continue;
    const titleScore = jaccard(tq, bigrams(b.title));
    const authorScore = authorOverlap(aq, b.authors.map(normText));
    const score = titleScore * 0.75 + authorScore * 0.25;
    if (!best || score > best.score) best = { book: b, score };
  }
  // Con autor exigimos menos al título (el autor confirma); sin autor, más.
  const threshold = authors.length ? 0.35 : 0.5;
  return best && best.score >= threshold ? best.book : null;
}

function authorOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  // Coincidencia por inclusión (apellido contenido) además de igualdad.
  for (const x of a) {
    if (setB.has(x)) return 1;
    for (const y of b) if (y.includes(x) || x.includes(y)) return 1;
  }
  return 0;
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const t = normText(s).replace(/ /g, "");
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
