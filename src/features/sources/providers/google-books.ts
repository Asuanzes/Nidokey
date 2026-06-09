/**
 * Cliente fino de la Google Books API (volumes) para la vertical LIBROS.
 *
 * Búsqueda pública SIN clave (cuota baja) o con GOOGLE_BOOKS_API_KEY (mayor
 * cuota). Devuelve los "volumes" CRUDOS; la normalización al modelo de dominio
 * `Book` la hace el adaptador con `fromGoogleBooks` (packages/shared/src/book.ts).
 *
 * Es API oficial pero la búsqueda anónima tiene cuota baja; con clave sube. La
 * API exige el parámetro `country` para resolver desde algunas IPs/servidores.
 * `cache: "no-store"` evita que Next.js cachee resultados.
 *
 * Semántica de errores: «sin resultados» devuelve []/null, pero «servicio no
 * disponible» (429 de cuota, clave inválida, 5xx, red) LANZA
 * ProviderUnavailableError — así el caller distingue "el libro no existe" de
 * "no se pudo consultar" y puede caer a Open Library o avisar con honestidad.
 */
import { getJsonStrict } from "./availability";

const BASE = "https://www.googleapis.com/books/v1/volumes";

/** País de mercado por defecto (la API lo exige). Multi-idioma/geo futuro:
 *  pasar el país/idioma del usuario en `opts`. */
const DEFAULT_COUNTRY = "ES";

function apiKey(): string {
  return process.env.GOOGLE_BOOKS_API_KEY?.trim() || "";
}

function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const u = new URL(`${BASE}${path}`);
  u.searchParams.set("country", DEFAULT_COUNTRY);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  const key = apiKey();
  if (key) u.searchParams.set("key", key);
  return u.toString();
}

async function getJson(url: string): Promise<unknown | null> {
  return getJsonStrict(url, { provider: "Google Books", timeoutMs: 9000 });
}

export type GoogleBooksSearchOpts = {
  /** ISO 639-1 ("es","en") → restringe el idioma de los resultados. */
  lang?: string;
  /** ISO 3166-1 alpha-2 ("ES","US") → mercado. Por defecto ES. */
  country?: string;
};

/** Busca volúmenes por texto (título/autor/ISBN). Devuelve los items crudos
 *  de Google Books (los normaliza el adaptador). */
export async function googleBooksSearch(
  query: string,
  opts: GoogleBooksSearchOpts = {},
): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = buildUrl("", {
    q,
    maxResults: "5",
    printType: "books",
    orderBy: "relevance",
    langRestrict: opts.lang,
    country: opts.country,
  });
  const json = (await getJson(url)) as { items?: unknown[] } | null;
  return json?.items ?? [];
}

/** Trae un volumen concreto por su volumeId (para el `fetch` del adaptador). */
export async function googleBooksVolume(volumeId: string): Promise<unknown | null> {
  const id = volumeId.trim();
  if (!id) return null;
  return getJson(buildUrl(`/${encodeURIComponent(id)}`, {}));
}
