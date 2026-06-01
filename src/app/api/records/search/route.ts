import { NextRequest, NextResponse } from "next/server";
import type { RecordType } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { pickAdapter } from "@/features/sources/registry";

/**
 * GET /api/records/search?type=job&what=…&where=…
 *
 * Búsqueda en fuentes tipo AGREGADOR (empleo/viajes…): el servidor consulta la
 * API externa (las claves nunca salen del backend) y devuelve VARIOS candidatos
 * normalizados. El cliente muestra la lista y el usuario registra el elegido vía
 * POST /api/records/import { input: { kind: "record", record } }.
 *
 * Auth: getUserId() (cookie/JWT/token). No necesita CORS (cliente móvil nativo).
 */
export async function GET(req: NextRequest) {
  const ownerId = await getUserId();
  if (!ownerId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") ?? "") as RecordType;
  const what = (sp.get("what") ?? "").trim();
  const where = sp.get("where")?.trim() || undefined;

  if (!what) return NextResponse.json({ results: [] });

  const adapter = pickAdapter(type, { kind: "search", what, where });
  if (!adapter?.search) {
    return NextResponse.json({ error: `Sin buscador disponible para "${type}"` }, { status: 422 });
  }

  try {
    const results = await adapter.search({ what, where });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[records-search] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error de búsqueda" },
      { status: 502 }
    );
  }
}
