import { NextRequest, NextResponse } from "next/server";
import type { Book } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { googleBooksAdapter } from "@/features/sources/adapters/google-books";
import type { NormalizedRecord } from "@/features/sources/types";

/**
 * GET /api/books/cover?title=&author=&isbn=
 *
 * SUGERENCIAS de portada para el alta MANUAL. NO crea nada ni decide el libro:
 * devuelve candidatos { url, title, author } para que el usuario ELIJA la portada
 * que encaja con su libro (o ninguna). El alta sigue siendo literal — esto solo
 * propone imágenes. Fuentes: Open Library (portada directa por ISBN, sin clave) +
 * Google Books (portadas de candidatos por isbn/título+autor, cada una con su
 * título para dar contexto).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const title = (sp.get("title") ?? "").trim();
  const author = (sp.get("author") ?? "").trim();
  const isbn = (sp.get("isbn") ?? "").replace(/[^0-9Xx]/g, "");
  if (title.length < 2 && isbn.length < 10) {
    return NextResponse.json({ covers: [] });
  }

  const covers: { url: string; title: string; author: string | null }[] = [];

  // Open Library: portada directa por ISBN. `default=false` → 404 si OL no la
  // tiene (así el cliente no muestra el placeholder gris de OL).
  if (isbn.length >= 10) {
    covers.push({
      url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      title: title || "Open Library",
      author: author || null,
    });
  }

  // Google Books: candidatos con portada. Cada uno lleva su título → el usuario ve
  // de qué libro es cada portada y elige la correcta (o ninguna si no encaja).
  try {
    const q = isbn.length >= 10 ? `isbn:${isbn}` : [title, author].filter(Boolean).join(" ");
    const hits = await googleBooksAdapter.search!(q);
    for (const h of hits.slice(0, 6)) {
      const rec = h.record as NormalizedRecord | undefined;
      const b = (rec?.meta as { book?: Book } | undefined)?.book;
      const url = b?.imageUrls?.large ?? b?.imageUrls?.thumbnail ?? rec?.imageUrl ?? null;
      if (url) covers.push({ url, title: h.name ?? title, author: h.exchange ?? (author || null) });
    }
  } catch {
    /* Google caído → solo OL (si había isbn) */
  }

  // Pocas: el usuario quiere elegir rápido, no scrollear. Máx 4 (OL por ISBN + 3 GB).
  const seen = new Set<string>();
  const out = covers.filter((c) => Boolean(c.url) && !seen.has(c.url) && seen.add(c.url)).slice(0, 4);
  return NextResponse.json({ covers: out });
}
