/**
 * Motor de detección de DUPLICADOS de registros, genérico y por tipo.
 *
 * Puro (web ↔ mobile ↔ backend): sin Prisma ni runtime de Node. El backend
 * proyecta sus filas a `DedupCandidate` y llama `findDuplicateGroups`; cada tipo
 * aporta un "descriptor" (cómo comparar dos fichas) en `DEDUP_DESCRIPTORS`.
 *
 * Diseño:
 *  - On-demand (no se almacenan sugerencias): se recalcula al abrir la pantalla.
 *  - Solo SUGIERE: agrupa candidatos; la fusión/descarte la decide el usuario.
 *  - Extensible: añadir un tipo nuevo = añadir su descriptor (o usar el por defecto).
 *
 * Reutiliza `bigrams`/`jaccard` de similarity.ts, pero NO `slugifyTitle` (sus
 * STOPWORDS son inmobiliarias y romperían títulos como "La casa de los espíritus").
 */
import type { RecordType } from "./records";
import { bigrams, jaccard } from "./similarity";

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Llaves/señales normalizadas que comparan los descriptores. Todas opcionales:
 *  cada tipo rellena las suyas. */
export interface DedupKeys {
  // Libros
  isbn13?: string | null;
  isbn10?: string | null;
  /** Open Library work id — agrupa TODAS las ediciones de una obra. */
  workId?: string | null;
  authors?: string[];
  /** ISO 639-1 ("es"/"en"). Señal: el difuso por título se limita al mismo idioma,
   *  pero la MISMA obra (ISBN/workId o título-núcleo+autor) agrupa entre idiomas. */
  language?: string | null;
  // Cripto / bolsa
  symbol?: string | null;
  // Empleo
  url?: string | null;
  company?: string | null;
  location?: string | null;
  // Genérica
  externalId?: string | null;
}

/** Proyección normalizada de una ficha para el matching (la arma el backend). */
export interface DedupCandidate {
  id: string;
  type: RecordType;
  title: string;
  keys: DedupKeys;
}

/** Resultado de comparar un par. `null` = un gate duro los excluye. */
export interface PairScore {
  score: number; // 0..100
  reasons: string[];
}

/** Compara dos candidatos del MISMO tipo. */
export type DedupDescriptor = (a: DedupCandidate, b: DedupCandidate) => PairScore | null;

/** Grupo de ≥2 fichas consideradas el mismo ítem. */
export interface DedupGroup {
  type: RecordType;
  /** Confianza conservadora: score mínimo entre los pares emparejados del grupo. */
  score: number;
  reasons: string[];
  ids: string[];
  /** El grupo mezcla ≥2 idiomas conocidos: lo que los diferencia es el idioma, así
   *  que la UI debe PREGUNTAR explícitamente antes de fusionar (no auto-asumir). */
  crossLanguage: boolean;
}

export interface FindOptions {
  /** Score mínimo de un par para considerarlo duplicado (default 65). */
  threshold?: number;
  /** Claves `dismissPairKey` de pares descartados por el usuario (se excluyen). */
  dismissedPairs?: Set<string>;
  /** Descriptor explícito (para tests); por defecto el del tipo de los candidatos. */
  descriptor?: DedupDescriptor;
}

// ── Helpers de normalización (neutros, sin stopwords de dominio) ───────────────

/** Minúsculas, sin acentos ni puntuación, espacios colapsados. NO quita stopwords
 *  (a diferencia de `slugifyTitle`): preserva títulos como "la casa de los espiritus". */
export function normalizeForMatch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similitud de títulos 0..1 (igualdad exacta → 1; si no, Jaccard de bigramas). */
function titleSim(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return jaccard(bigrams(na), bigrams(nb));
}

/** Título-núcleo: lo que va ANTES del primer separador de subtítulo o anotación
 *  de edición (":", ".", "-", "(", "[", "|", ","). Normaliza el resultado. Así
 *  "Sapiens: De animales a dioses", "Sapiens. Breve historia", "Sapiens" y
 *  "Sapiens [Tenth Anniversary Edition]" comparten núcleo "sapiens". Se corta
 *  ANTES de normalizar porque normalizeForMatch ya borra la puntuación. */
function primaryTitle(raw: string): string {
  const head = raw.split(/[:.\-–—(\[\]|,]/)[0] ?? raw;
  return normalizeForMatch(head);
}

/** Nº de tokens significativos de autor (≥3 chars) compartidos. Robusto a orden
 *  ("Gabriel García Márquez" vs "García Márquez, Gabriel") y a iniciales. Un solo
 *  token (apellido común: "garcia", "lopez") es señal DÉBIL; ≥2 es fuerte. */
function authorSharedTokens(a?: string[], b?: string[]): number {
  if (!a?.length || !b?.length) return 0;
  const toks = (arr: string[]) =>
    new Set(arr.flatMap((x) => normalizeForMatch(x).split(" ")).filter((t) => t.length >= 3));
  const ta = toks(a);
  const tb = toks(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared;
}

/** Clave canónica (ordenada) de un par, para registrar/excluir descartes. */
export function dismissPairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

// ── Descriptores por tipo ──────────────────────────────────────────────────────

/** LIBROS: ISBN/obra exactos → casi seguro; si no, título+autor difuso. Gate de
 *  idioma: ediciones en idiomas distintos NO son duplicados. */
const bookDescriptor: DedupDescriptor = (a, b) => {
  const la = a.keys.language;
  const lb = b.keys.language;
  const sameLang = !la || !lb || la === lb; // idioma desconocido = compatible

  // IDENTIDAD de edición/obra → el idioma es IRRELEVANTE (es el mismo libro):
  // mismo ISBN-13/10 (edición exacta) o misma obra (Open Library workId).
  if (a.keys.isbn13 && b.keys.isbn13 && a.keys.isbn13 === b.keys.isbn13) {
    return { score: 100, reasons: ["Mismo ISBN"] };
  }
  if (a.keys.isbn10 && b.keys.isbn10 && a.keys.isbn10 === b.keys.isbn10) {
    return { score: 100, reasons: ["Mismo ISBN"] };
  }
  if (a.keys.workId && b.keys.workId && a.keys.workId === b.keys.workId) {
    return { score: 96, reasons: ["Misma obra"] };
  }

  // Para evitar agrupar libros DISTINTOS del mismo autor:
  //  - títulos cortos (<10 chars) inflan el jaccard de bigramas → exigir casi igualdad;
  //  - el tier bajo exige ≥2 tokens de autor compartidos (un apellido común no basta).
  const shared = authorSharedTokens(a.keys.authors, b.keys.authors);
  if (shared >= 1) {
    // (a) MISMA OBRA por título-núcleo + autor. Vale AUNQUE el idioma sea distinto:
    //     "Sapiens" (en), "Sapiens. De animales a dioses" (es) y
    //     "Sapiens [Tenth Anniversary Edition]" (en) de Harari son el mismo libro.
    //     El núcleo (primaryTitle) ignora subtítulos y anotaciones de edición.
    //     Núcleo ≥5 chars para no agrupar por palabras sueltas comunes.
    const pa = primaryTitle(a.title);
    const pb = primaryTitle(b.title);
    if (pa.length >= 5 && pa === pb) {
      return { score: shared >= 2 ? 90 : 82, reasons: ["Misma obra (título y autor)"] };
    }
    // (b) Título COMPLETO muy parecido → SOLO dentro del mismo idioma (evita unir
    //     libros distintos pero parecidos, o traducciones de títulos diferentes).
    if (sameLang) {
      const t = titleSim(a.title, b.title);
      const shortTitle =
        Math.min(normalizeForMatch(a.title).length, normalizeForMatch(b.title).length) < 10;
      const highBar = shortTitle ? 0.92 : 0.85;
      if (t >= highBar) return { score: 88, reasons: ["Mismo título y autor"] };
      if (shared >= 2 && !shortTitle && t >= 0.75) {
        return { score: 70, reasons: ["Título y autor similares"] };
      }
    }
  }
  return null;
};

/** EMPLEO: misma URL/identificador de oferta → exacto; si no, puesto+empresa(+ubic). */
const jobDescriptor: DedupDescriptor = (a, b) => {
  if (a.keys.url && b.keys.url && a.keys.url === b.keys.url) {
    return { score: 100, reasons: ["Misma URL de oferta"] };
  }
  if (a.keys.externalId && b.keys.externalId && a.keys.externalId === b.keys.externalId) {
    return { score: 100, reasons: ["Mismo identificador de oferta"] };
  }
  const sameCompany =
    !!a.keys.company &&
    !!b.keys.company &&
    normalizeForMatch(a.keys.company) === normalizeForMatch(b.keys.company);
  if (!sameCompany) return null;
  const t = titleSim(a.title, b.title);
  const sameLoc =
    !!a.keys.location &&
    !!b.keys.location &&
    normalizeForMatch(a.keys.location) === normalizeForMatch(b.keys.location);
  if (t >= 0.85 && sameLoc) return { score: 84, reasons: ["Mismo puesto, empresa y ubicación"] };
  if (t >= 0.9) return { score: 76, reasons: ["Mismo puesto y empresa"] };
  return null;
};

/** CRIPTO/BOLSA: mismo símbolo normalizado (entre fuentes/quote/exchange) o mismo
 *  activo por nombre (BTC vs XBT con título "Bitcoin"). */
const symbolDescriptor: DedupDescriptor = (a, b) => {
  const sa = a.keys.symbol ? normalizeForMatch(a.keys.symbol) : "";
  const sb = b.keys.symbol ? normalizeForMatch(b.keys.symbol) : "";
  if (sa && sb && sa === sb) return { score: 95, reasons: ["Mismo símbolo"] };
  if (titleSim(a.title, b.title) >= 0.95) return { score: 80, reasons: ["Mismo activo"] };
  return null;
};

/** Por defecto (tipos sin descriptor propio, p.ej. futuros renting/holiday/workout):
 *  solo título prácticamente idéntico. Refinar al desarrollar la vertical. */
const defaultDescriptor: DedupDescriptor = (a, b) => {
  if (titleSim(a.title, b.title) >= 0.95) return { score: 85, reasons: ["Mismo título"] };
  return null;
};

export const DEDUP_DESCRIPTORS: Partial<Record<RecordType, DedupDescriptor>> = {
  book: bookDescriptor,
  job: jobDescriptor,
  crypto: symbolDescriptor,
  market: symbolDescriptor,
};

export function descriptorFor(type: RecordType): DedupDescriptor {
  return DEDUP_DESCRIPTORS[type] ?? defaultDescriptor;
}

// ── Agrupado (híbrido: identidad transitiva + difuso por enlace completo) ──────

/** Score a partir del cual una arista es IDENTIDAD (mismo ISBN/obra/URL/símbolo):
 *  transitiva segura (A=B y B=C ⇒ A,B,C son el mismo ítem aunque A,C no se hayan
 *  comparado por la misma clave). Por debajo es difusa → enlace completo. */
const EXACT_GROUP_SCORE = 95;

/** Agrupa candidatos del MISMO tipo en grupos de duplicados (≥2). O(n²) por tipo,
 *  apto para escala personal (n≤~500).
 *
 *  Híbrido, para ser robusto Y conservador:
 *   1. IDENTIDAD (score ≥ 95: mismo ISBN, misma obra, misma URL, mismo símbolo)
 *      → unión TRANSITIVA (union-find). Tres ediciones encadenadas por claves
 *      exactas distintas (A=B por ISBN, B=C por obra) acaban en el mismo grupo
 *      aunque A,C no compartan clave. Resuelve el típico "3 'Sapiens' sueltos".
 *   2. DIFUSO (título/autor) → solo fusiona dos componentes si TODOS los pares
 *      cruzados casan (enlace completo). Evita "A~B y B~C ⇒ A,C" cuando A≁C
 *      (dos novelas distintas del mismo autor). La fusión borra fichas, así que
 *      lo difuso se mantiene estricto. */
export function findDuplicateGroups(
  candidates: DedupCandidate[],
  opts: FindOptions = {},
): DedupGroup[] {
  const n = candidates.length;
  if (n < 2) return [];
  const threshold = opts.threshold ?? 65;
  const dismissed = opts.dismissedPairs ?? new Set<string>();
  const type = candidates[0].type;
  const descriptor = opts.descriptor ?? descriptorFor(type);

  // Matriz simétrica de aristas: pares que superan el umbral y no están descartados.
  const edge: (PairScore | null)[][] = Array.from({ length: n }, () =>
    new Array<PairScore | null>(n).fill(null),
  );
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dismissed.has(dismissPairKey(candidates[i].id, candidates[j].id))) continue;
      const res = descriptor(candidates[i], candidates[j]);
      if (res && res.score >= threshold) {
        edge[i][j] = res;
        edge[j][i] = res;
      }
    }
  }

  // Union-find.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // 1) Identidad exacta → unión transitiva.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (edge[i][j] && edge[i][j]!.score >= EXACT_GROUP_SCORE) union(i, j);
    }
  }

  const components = (): number[][] => {
    const map = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      const arr = map.get(r);
      if (arr) arr.push(i);
      else map.set(r, [i]);
    }
    return [...map.values()];
  };

  // 2) Difuso: fusiona dos componentes solo si TODOS sus pares cruzados casan.
  let merged = true;
  while (merged) {
    merged = false;
    const comps = components();
    for (let x = 0; x < comps.length && !merged; x++) {
      for (let y = x + 1; y < comps.length && !merged; y++) {
        const A = comps[x];
        const B = comps[y];
        let full = true;
        for (const a of A) {
          for (const b of B) {
            if (!edge[a][b]) {
              full = false;
              break;
            }
          }
          if (!full) break;
        }
        if (full) {
          union(A[0], B[0]);
          merged = true;
        }
      }
    }
  }

  // 3) Emite grupos ≥2. score = mínimo entre las aristas REALIZADAS del grupo.
  const groups: DedupGroup[] = [];
  for (const members of components()) {
    if (members.length < 2) continue;
    let minScore = 100;
    const reasons = new Set<string>();
    for (let x = 0; x < members.length; x++) {
      for (let y = x + 1; y < members.length; y++) {
        const e = edge[members[x]][members[y]];
        if (e) {
          minScore = Math.min(minScore, e.score);
          e.reasons.forEach((r) => reasons.add(r));
        }
      }
    }
    if (reasons.size === 0) continue; // sin arista realizada (no debería ocurrir)
    // ¿El grupo mezcla idiomas conocidos? Genérico para cualquier tipo con
    // `keys.language`: si hay ≥2 idiomas, lo que los diferencia es el idioma →
    // la UI lo marca para PREGUNTAR antes de fusionar.
    const langs = new Set(
      members.map((m) => candidates[m].keys.language).filter((l): l is string => !!l),
    );
    groups.push({
      type,
      score: minScore,
      reasons: [...reasons],
      ids: members.map((m) => candidates[m].id),
      crossLanguage: langs.size >= 2,
    });
  }
  groups.sort((a, b) => b.score - a.score);
  return groups;
}
