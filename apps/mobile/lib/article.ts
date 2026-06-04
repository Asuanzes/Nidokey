import type { NewsItem } from "@/lib/hooks/useNews";

/**
 * Modelo de artículo de noticia, GENÉRICO y desacoplado de cripto/mercados, para
 * que cualquier sección de noticias futura pueda reutilizar la pantalla de
 * detalle. Módulo puro (sin React/RN) → testeable y reusable.
 */
export type Article = {
  id: string; // = url (NewsItem no tiene id; la url es la clave única)
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  summary: string | null; // resumen ya provisto por el backend, si lo hay
};

/** NewsItem (cripto/mercado) → Article. Descarta `symbol` (específico de sección). */
export function newsItemToArticle(n: NewsItem): Article {
  return {
    id: n.url,
    title: n.title,
    url: n.url,
    source: n.source,
    publishedAt: n.publishedAt,
    summary: n.summary,
  };
}

/** Payload que el JS inyectado en el WebView devuelve tras cargar la página. */
export type ArticleExtract = {
  ogDescription: string | null;
  mainHtml: string | null; // innerHTML de <article>/<main>/<body>, capado ~30 KB
};

/**
 * HTML → resumen corto (PURA). Quita el "cromo" (script/style/nav/header/footer/
 * aside/form/figure), prefiere el texto de los <p>, normaliza espacios y corta
 * cerca de `maxChars` en una frontera de frase o palabra. Deliberadamente simple
 * y determinista; la vía "inteligente" es el hook LLM de abajo.
 */
export function extractSummaryFromHtml(html: string, maxChars = 600): string {
  if (!html) return "";
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form|figure)\b[\s\S]*?<\/\1>/gi, " ");

  // Texto de párrafos (descarta fragmentos cortos: pies de foto, menús, bylines).
  const paras = [...cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => normalizeWs(decodeEntities(stripTags(m[1]))))
    .filter((t) => t.length >= 40);

  let text = paras.join(" ");
  if (text.length < 80) text = normalizeWs(decodeEntities(stripTags(cleaned))); // fallback

  return cutAtBoundary(text, maxChars);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Decodifica las entidades HTML más comunes (incl. numéricas → acentos en es). */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)));
}

function safeCp(code: number): string {
  try {
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  } catch {
    return "";
  }
}

function cutAtBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd > max * 0.5) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(" ");
  return (wordEnd > 0 ? slice.slice(0, wordEnd) : slice).trimEnd() + "…";
}

/**
 * HOOK PARA UN RESUMEN POR LLM (sin backend todavía).
 *
 * `extractSummaryFromHtml` es el resumidor síncrono por defecto. Para enchufar un
 * resumen "inteligente" más adelante, asigna aquí un `ArticleSummarizer` (p. ej.
 * un POST a un futuro `/api/summarize` que llame a Anthropic, o el LLM on-device).
 * Mientras valga `null`, la UI usa la extracción heurística de arriba.
 */
export type ArticleSummarizer = (input: {
  title: string;
  html: string;
  url: string;
}) => Promise<string>;

export const articleSummarizer: ArticleSummarizer | null = null;
