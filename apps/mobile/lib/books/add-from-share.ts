import { api } from "@/lib/api";
import { bookShareQuery, firstShareUrl } from "@/lib/book-url";

/**
 * Añade un libro a partir del texto compartido SIN navegar.
 *
 * En Android el share arranca una segunda instancia del componente raíz → dos
 * navegadores → navegar desde el handler del share corrompe TODA la navegación
 * ("Attempted to navigate before mounting"). La solución robusta es no navegar:
 * resolvemos + añadimos en segundo plano y avisamos con un Alert. La lista para
 * elegir (caso ambiguo) se ve cuando el usuario abre Añadir › Libros (el texto
 * queda en cola vía setBookShare, fuera de aquí).
 *
 * Reglas (igual que el flujo de Importar): solo AUTO-añade con match FIABLE
 * (ISBN exacto, o el pipeline del servidor); título ambiguo → "pick".
 */

type SearchHit = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null;
  record?: unknown;
};

export type ShareAddResult =
  | { status: "added"; title: string }
  | { status: "pick"; query: string } // varios candidatos → elige en Importar
  | { status: "none" };

export async function addBookFromShare(sharedText: string): Promise<ShareAddResult> {
  const parsed = bookShareQuery(sharedText);
  const url = firstShareUrl(sharedText);

  let hits: SearchHit[] = [];
  let reliable = false;
  try {
    // 1) ISBN en la cadena/URL → match exacto.
    if (parsed?.isbn) {
      const res = await api<{ results: SearchHit[] }>(
        `/api/records/search?type=book&q=${encodeURIComponent(`isbn:${parsed.query}`)}`,
      );
      hits = res.results ?? [];
      reliable = hits.length > 0;
    }
    // 2) Hay URL → pipeline del servidor (schema.org → Google Books/OL, vetado).
    if (!reliable && url) {
      const res = await api<{ results: SearchHit[] }>("/api/books/resolve", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      const rh = res.results ?? [];
      if (rh.length > 0) {
        hits = rh;
        reliable = true;
      }
    }
    // 3) Solo título → fiable solo si el primero casa FUERTE; si no, "pick".
    if (!reliable && parsed?.query) {
      const res = await api<{ results: SearchHit[] }>(
        `/api/records/search?type=book&q=${encodeURIComponent(parsed.query)}`,
      );
      hits = res.results ?? [];
      reliable = hits.length > 0 && strongTitleMatch(parsed.query, hits[0].name);
    }
  } catch {
    /* red caída → none */
  }

  if (reliable && hits[0]?.record) {
    try {
      const r = await api<{ record: { title: string } | null }>("/api/records/import", {
        method: "POST",
        body: JSON.stringify({ type: "book", input: { kind: "record", record: hits[0].record } }),
      });
      return { status: "added", title: r.record?.title ?? hits[0].name ?? "Libro" };
    } catch {
      return { status: "none" };
    }
  }
  if (hits.length > 0 && parsed?.query) return { status: "pick", query: parsed.query };
  return { status: "none" };
}

/** ¿El primer resultado casa FUERTE con el título compartido? (evita auto-añadir
 *  el libro equivocado en títulos cortos/ambiguos). */
function strongTitleMatch(shared: string, hitName: string | null): boolean {
  if (!hitName) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(shared);
  const b = norm(hitName);
  if (a.length < 12 || a.split(" ").length < 3) return false;
  return b.includes(a) || a.includes(b);
}
