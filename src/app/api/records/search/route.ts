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

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const type = (req.nextUrl.searchParams.get("type") ?? "market") as RecordType;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const adapter = adaptersFor(type).find((a) => typeof a.search === "function");
  if (!adapter?.search) return NextResponse.json({ results: [] });

  // Filtros opcionales (empleo: ciudad/zona + remoto). Las fuentes que no los
  // usen los ignoran.
  const location = req.nextUrl.searchParams.get("location")?.trim() || undefined;
  const remote = req.nextUrl.searchParams.get("remote") === "1";

  try {
    const results = await adapter.search(q, { location, remote });
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error de búsqueda", results: [] },
      { status: 502 }
    );
  }
}
