import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

import { getUserId } from "@/lib/auth-helpers";
import { adaptersFor } from "@/features/sources/registry";
import type { SearchHit } from "@/features/sources/types";

/**
 * POST /api/books/resolve  { url }
 *
 * Resolver "manda lo que haya a Google Books" del lado SERVIDOR (parte robusta
 * del híbrido de share de LIBROS). El cliente intenta primero sacar ISBN/título
 * de la cadena compartida; si la URL es OPACA (sin ISBN ni título legible), llama
 * aquí: abrimos la página de la tienda, leemos el ISBN/título de sus METADATOS
 * (JSON-LD schema.org/Book·Product, meta og:/book:/product:isbn, o regex de
 * ISBN-13) y lo resolvemos contra los adaptadores de libros (Google Books → Open
 * Library). Así cubrimos "mil tiendas, mil URLs" sin un parser por tienda.
 *
 * Devuelve la MISMA forma que /api/records/search: { results: SearchHit[] } (con
 * el NormalizedRecord embebido para importar sin re-fetch), + `extracted` para
 * diagnóstico.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "No autenticado", results: [] }, { status: 401 });

  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = String(body?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Body inválido", results: [] }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "URL inválida", results: [] }, { status: 400 });
  }

  // 1) Descargar la página de la tienda (best-effort; si bloquea, results vacío).
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) html = await res.text();
  } catch {
    /* sin red / bloqueo / timeout → caemos a results vacío */
  }

  const { isbn, title } = html ? extractBookMeta(html) : { isbn: null, title: null };

  // 2) Resolver: ISBN exacto primero (q=isbn:…), título después. Cadena de
  //    adaptadores (Google Books → Open Library), igual que /api/records/search.
  const queries = [isbn ? `isbn:${isbn}` : null, title].filter((q): q is string => !!q);
  const searchable = adaptersFor("book").filter((a) => typeof a.search === "function");
  let results: SearchHit[] = [];
  outer: for (const q of queries) {
    for (const adapter of searchable) {
      try {
        const hits = await adapter.search!(q);
        if (hits.length > 0) {
          results = hits;
          break outer;
        }
      } catch {
        /* fuente caída → siguiente adaptador */
      }
    }
  }

  return NextResponse.json({ results, extracted: { isbn, title } });
}

// ── Extracción de metadatos de libro de la página ──────────────────────────────

function extractBookMeta(html: string): { isbn: string | null; title: string | null } {
  let $: ReturnType<typeof cheerio.load>;
  try {
    $ = cheerio.load(html);
  } catch {
    return { isbn: isbnFromRegex(html), title: null };
  }

  let isbn: string | null = null;
  let title: string | null = null;

  // a) JSON-LD (schema.org Book / Product): isbn, gtin13, gtin, name.
  $('script[type="application/ld+json"]').each((_, el) => {
    if (isbn && title) return;
    const raw = $(el).text();
    if (!raw) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of flattenJsonLd(data)) {
      if (!isbn) {
        const norm = normalizeIsbn(firstString(node.isbn ?? node.gtin13 ?? node.gtin ?? node.gtin14));
        if (norm) isbn = norm;
      }
      if (!title) {
        const type = String(node["@type"] ?? "").toLowerCase();
        if ((type.includes("book") || type.includes("product")) && typeof node.name === "string") {
          const t = cleanTitle(node.name);
          if (t.length >= 2) title = t;
        }
      }
    }
  });

  // b) Meta tags / microdata.
  if (!isbn) {
    const metaIsbn =
      $('meta[property="book:isbn"]').attr("content") ??
      $('meta[property="og:isbn"]').attr("content") ??
      $('meta[property="product:isbn"]').attr("content") ??
      $('meta[name="isbn"]').attr("content") ??
      $('[itemprop="isbn"]').attr("content") ??
      $('[itemprop="isbn"]').first().text();
    const norm = normalizeIsbn(metaIsbn);
    if (norm) isbn = norm;
  }
  if (!title) {
    const ogt = $('meta[property="og:title"]').attr("content") ?? $("title").first().text();
    if (ogt) {
      const t = cleanTitle(ogt);
      if (t.length >= 2) title = t;
    }
  }

  // c) Último recurso: ISBN-13 por regex en el HTML.
  if (!isbn) isbn = isbnFromRegex(html);

  return { isbn, title };
}

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

function firstString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function normalizeIsbn(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(d)) return d; // ISBN-13
  if (/^\d{9}[\dX]$/.test(d)) return d; // ISBN-10
  return null;
}

function isbnFromRegex(html: string): string | null {
  const m = html.match(/97[89][-\s]?(?:\d[-\s]?){9}\d/);
  return normalizeIsbn(m?.[0] ?? null);
}

function cleanTitle(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  // Sufijo de tienda tras "|" (Fnac, Casa del Libro…) → quédate con lo de antes.
  if (t.includes("|")) t = t.split("|")[0].trim();
  return t.slice(0, 200);
}
