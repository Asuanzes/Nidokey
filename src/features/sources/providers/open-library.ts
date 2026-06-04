/**
 * Cliente fino de Open Library (openlibrary.org) — fuente de LIBROS SIN clave
 * (keyless), fallback de Google Books. `search.json` devuelve docs planos con
 * portada/ISBN/año/rating; la sinopsis NO viene en la búsqueda (se enriquece con
 * el work API en el fetch). Devuelve datos CRUDOS; los normaliza el adaptador
 * con `fromOpenLibrary` (packages/shared/src/book.ts).
 */
const SEARCH = "https://openlibrary.org/search.json";
const FIELDS =
  "key,title,author_name,first_publish_year,isbn,cover_i,language," +
  "number_of_pages_median,ratings_average,ratings_count,subject,publisher";
const UA = "Nidokey/1.0 (personal book tracker)";

async function getJson(url: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      // OL search es a veces lento (>9s); damos margen (la ruta tiene maxDuration 60).
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** Busca libros por texto (título/autor). Devuelve los docs crudos. */
export async function openLibrarySearch(query: string): Promise<unknown[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&limit=12&fields=${encodeURIComponent(FIELDS)}`;
  const json = (await getJson(url)) as { docs?: unknown[] } | null;
  return json?.docs ?? [];
}

/** Detalle de un work (para la sinopsis en el fetch directo). */
export async function openLibraryWork(workId: string): Promise<unknown | null> {
  const id = workId.trim();
  if (!id) return null;
  return getJson(`https://openlibrary.org/works/${encodeURIComponent(id)}.json`);
}
