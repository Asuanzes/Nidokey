import type { Book } from "@nidokey/shared";

/**
 * Tipos del pipeline de resolución de libros desde una URL.
 *
 * Filosofía: la página de la tienda es solo una PISTA. No nos fiamos del HTML
 * concreto de cada web (mil tiendas, mil formatos) sino que extraemos
 * identificadores estándar (sobre todo ISBN) y los resolvemos contra APIs de
 * metadatos fiables (Google Books, Open Library) que devuelven datos
 * normalizados. El `Book` de @nidokey/shared es el modelo de dominio único.
 */

/** Pistas mínimas extraídas de la página (lo único que necesitamos de su HTML). */
export interface BookHints {
  /** ISBN-10 o ISBN-13 ya normalizado (solo dígitos / X). Lo más fiable. */
  isbn?: string;
  /** Título limpio (schema.org/Book name, og:title o <title> sin sufijo de tienda). */
  title?: string;
  /** Autores (de schema.org/Book author). */
  authors?: string[];
}

/** Errores tipados que la app puede consumir y mostrar con un mensaje claro. */
export type ImportErrorCode =
  /** La URL no es http(s) válida. */
  | "INVALID_URL"
  /** Fallo de red / timeout descargando la página. */
  | "NETWORK_ERROR"
  /** No se pudo extraer NI ISBN NI título de la página (sin pista útil). */
  | "ISBN_NOT_FOUND"
  /** Se extrajeron pistas pero ni Google Books ni Open Library resuelven el libro. */
  | "BOOK_NOT_FOUND"
  /** Algún proveedor estaba caído/sin cuota y no se pudo confirmar si el libro
   *  existe → reintentable. NO es un "no encontrado" definitivo. */
  | "PROVIDERS_UNAVAILABLE"
  /** Varios candidatos sin un match suficientemente claro (reservado para scoring). */
  | "AMBIGUOUS";

export interface ImportError {
  ok: false;
  code: ImportErrorCode;
  message: string;
}

export interface ResolveOk {
  ok: true;
  book: Book;
  /** Cómo se resolvió: por ISBN (fiable) o por título+autor (fuzzy). */
  via: "isbn" | "title-author";
  /** Pistas que se usaron (útil para diagnóstico/telemetría). */
  hints: BookHints;
}

/**
 * Resultado de `resolveBookFromUrl`. Unión etiquetada (mejor que `Book |
 * ImportError` suelto): permite discriminar con `if (result.ok)` sin perder el
 * tipo del error ni las pistas usadas.
 */
export type ResolveResult = ResolveOk | ImportError;

export type { Book };
