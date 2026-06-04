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
  "amzn.",
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

// ── Share de TEXTO (título + enlace) ─────────────────────────────────────────
// Muchas apps (Amazon, tiendas) comparten "Título … <enlace>" como text/plain, y
// el enlace suele ser CORTO sin ISBN (amzn.eu/d/XXXX). Lo identificable es el
// TÍTULO en el texto. Estas funciones trabajan sobre el texto compartido COMPLETO.

function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

function isBookHost(url: string): boolean {
  const low = url.toLowerCase();
  return BOOK_HOSTS.some((h) => low.includes(h));
}

/** ¿El texto compartido parece un libro? (lleva un ISBN, o un enlace de un host
 *  de libros conocido — Amazon/amzn, Google Books, Open Library, tiendas…). */
export function isBookShareText(text: string): boolean {
  if (!text) return false;
  if (extractIsbn(text)) return true;
  const url = firstUrl(text);
  return !!(url && isBookHost(url));
}

/** Query buscable a partir del texto compartido: ISBN si lo hay (match fiable →
 *  añadir solo); si no, el TÍTULO (el texto sin la URL ni el "(Editorial)" final).
 *  null si no hay nada útil. Sirve igual para texto compartido y para pegar. */
export function bookShareQuery(text: string): { query: string; isbn: boolean } | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const isbn = extractIsbn(t);
  if (isbn) return { query: isbn, isbn: true };
  const url = firstUrl(t);
  if (url && isBookHost(url)) {
    let title = t
      .replace(/https?:\/\/[^\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s*\([^)]*\)\s*$/, "") // quita "(Editorial)" del final
      .trim();
    // El título PRINCIPAL (antes del subtítulo tras ":") casa mejor en la
    // búsqueda que la cadena larga que mandan Amazon/tiendas.
    const main = title.split(":")[0].trim();
    if (main.length >= 3) title = main;
    if (title.length >= 3) return { query: title, isbn: false };
    // Sin título en el TEXTO (p. ej. Fnac comparte solo la URL): sácalo del SLUG
    // de la ruta (fnac.es/a<id>/<Autor-Título-con-guiones>, Casa del Libro…).
    const fromSlug = titleFromSlug(url);
    if (fromSlug && fromSlug.length >= 3) return { query: fromSlug, isbn: false };
  }
  return null;
}

/** Título buscable a partir del SLUG de la ruta (último segmento con guiones y
 *  letras). Cubre tiendas que comparten SOLO la URL (Fnac, Casa del Libro…)
 *  cuando no hay título en el texto. Descarta ids tipo "a12900214". */
function titleFromSlug(u: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  const known = titleFromUrl(parsed); // Google Books /edition/, Goodreads /show/
  if (known) return known;
  const segs = parsed.pathname.split("/").map(safeDecode).filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    if (s.includes("-") && /[a-zA-Záéíóúñ]/i.test(s)) {
      const words = slug(s).trim();
      if (words.length >= 3) return words;
    }
  }
  return null;
}
