/**
 * Detección/parseo de URLs de LIBROS compartidas (share / deep-link) para
 * añadirlas a la vertical Libros. Estrategia:
 *  - ISBN en la URL (Amazon /dp/…, /isbn/…, tiendas con ISBN-13) → coincidencia
 *    FIABLE → el libro se añade automáticamente.
 *  - Sin ISBN pero host de libros conocido + título en el slug (Google Books
 *    /books/edition/<título>/<id>, Goodreads) → se pre-busca por ese título para
 *    que elijas.
 *  - En otro caso → null (no se reconoce como enlace de libro).
 */
const BOOK_HOSTS = [
  "books.google.",
  "google.com/books",
  "play.google.com/store/books",
  "openlibrary.org",
  "goodreads.com",
  "amazon.",
  "casadellibro.",
  "todostuslibros.",
  "fnac.",
  "agapea.",
];

export function isBookUrl(u: string): boolean {
  return bookUrlQuery(u) !== null;
}

/** Query buscable del enlace + si es un ISBN (match fiable). null si no aplica. */
export function bookUrlQuery(u: string): { query: string; isbn: boolean } | null {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }

  // 1) ISBN en la URL (lo más fiable).
  const isbn = extractIsbn(u);
  if (isbn) return { query: isbn, isbn: true };

  // 2) Host de libros conocido + título en el slug.
  const low = u.toLowerCase();
  const known = BOOK_HOSTS.some((h) => low.includes(h));
  if (!known) return null;
  const title = titleFromUrl(parsed);
  if (title && title.length >= 3) return { query: title, isbn: false };
  return null;
}

/** ISBN-13 (978/979 + 10 dígitos) en cualquier parte; ISBN-10 solo en rutas
 *  fiables (/dp/, /isbn/, /gp/product/) para no confundir números cualesquiera. */
function extractIsbn(u: string): string | null {
  const m13 = u.match(/97[89]\d{10}/);
  if (m13) return m13[0];
  const m10 = u.match(/\/(?:dp|isbn|gp\/product)\/(\d{9}[\dxX])(?:[/?&#]|$)/i);
  if (m10) return m10[1].toUpperCase();
  return null;
}

/** Mejor esfuerzo: título buscable del path (slugs con guiones). */
function titleFromUrl(parsed: URL): string | null {
  const seg = parsed.pathname.split("/").map(safeDecode).filter(Boolean);
  const ei = seg.indexOf("edition"); // Google Books: /books/edition/<título>/<id>
  if (ei >= 0 && seg[ei + 1]) return slug(seg[ei + 1]);
  const si = seg.indexOf("show"); // Goodreads: /book/show/<id>-<título>
  if (si >= 0 && seg[si + 1]) return slug(seg[si + 1].replace(/^\d+[-_]?/, ""));
  return null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
function slug(s: string): string {
  return s.replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
}
