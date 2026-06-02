import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { adaptersFor } from "@/features/sources/registry";

/**
 * GET /api/records/search?type=market&q=vaneck
 *
 * Busca candidatos a importar (nombre/ticker → símbolo + bolsa) para el modo
 * "buscar y elegir". Lo resuelve el adapter del tipo que implemente `search`
 * (hoy: mercados vía Yahoo). Requiere sesión; no toca la lógica de /api/auth.
 */
export const dynamic = "force-dynamic";
// Empleo consulta dos actores de Apify en paralelo; InfoJobs (arranque en frío)
// puede tardar más que el timeout por defecto (~10s) → sin esto, sus resultados
// se pierden y solo salía LinkedIn. 60s da margen a ambos.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const type = (req.nextUrl.searchParams.get("type") ?? "market") as RecordType;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  // Filtros opcionales (empleo: ciudad/zona + remoto + fuentes). Las fuentes que
  // no los usen los ignoran.
  const location = req.nextUrl.searchParams.get("location")?.trim() || undefined;
  const remote = req.nextUrl.searchParams.get("remote") === "1";
  // Empleo: qué portales consultar ("infojobs,linkedin,indeed"). Vacío = todos.
  const sources = req.nextUrl.searchParams
    .get("sources")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Se necesita texto (≥2) O una zona (empleo: buscar todo lo que haya en ella).
  if (q.length < 2 && !location) return NextResponse.json({ results: [] });

  const adapter = adaptersFor(type).find((a) => typeof a.search === "function");
  if (!adapter?.search) return NextResponse.json({ results: [] });

  try {
    const results = await adapter.search(q, { location, remote, sources });
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error de búsqueda", results: [] },
      { status: 502 }
    );
  }
}
