import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { BaseRecord, RecordType } from "@nidokey/shared";

import { getUserId } from "@/lib/auth-helpers";
import { pickAdapter } from "@/features/sources/registry";
import { upsertRecord, getCryptoById, getMarketById } from "@/features/sources/upsert";
import { cryptoToBaseRecord, marketToBaseRecord } from "@/lib/records/mapper";

/**
 * POST /api/records/import — ingesta UNIFICADA de registros (todos los tipos).
 *
 * Body: { type, input: SourceInput, source? }
 *   input = { kind:"url", url } | { kind:"symbol", symbol, quote? } | { kind:"query", query }
 *
 * Auth: getUserId() (cookie web / JWT móvil / token bs_) — mismo resolver que
 * todo el backend, sin lógica de token paralela. Para fuentes con API oficial
 * (cripto/mercados) la extracción corre server-side aquí; para fuentes
 * `manualOnly` (scrape duro) devuelve { needsClient: true } y el WebView del
 * móvil postea el registro normalizado por el mismo canal (fase posterior).
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Body = z.object({
  type: z.string().min(1),
  source: z.string().optional(),
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.string().url() }),
    z.object({ kind: z.literal("symbol"), symbol: z.string().min(1), quote: z.string().optional() }),
    z.object({ kind: z.literal("query"), query: z.string().min(1) }),
  ]),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ownerId = await getUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: CORS_HEADERS });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: CORS_HEADERS });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", issues: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const type = parsed.data.type as RecordType;
  const input = parsed.data.input;

  const adapter = pickAdapter(type, input);
  if (!adapter) {
    return NextResponse.json(
      { error: `Sin fuente disponible para "${type}" con esa entrada`, needsClient: true },
      { status: 422, headers: CORS_HEADERS }
    );
  }
  if (adapter.manualOnly) {
    return NextResponse.json(
      { error: "Esta fuente requiere captura desde el cliente", needsClient: true },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const outcome = await adapter.fetch(input);
  if (outcome.kind !== "ok") {
    const status = outcome.kind === "gone" ? 404 : outcome.kind === "blocked" ? 422 : 502;
    const reason = outcome.kind === "error" ? outcome.error : outcome.reason;
    return NextResponse.json({ error: reason, kind: outcome.kind }, { status, headers: CORS_HEADERS });
  }

  try {
    const { id, created } = await upsertRecord(ownerId, outcome.record);
    let record: BaseRecord | null = null;
    if (type === "crypto") {
      const r = await getCryptoById(id);
      record = r ? cryptoToBaseRecord(r) : null;
    } else if (type === "market") {
      const r = await getMarketById(id);
      record = r ? marketToBaseRecord(r) : null;
    }
    return NextResponse.json(
      { created, record },
      { status: created ? 201 : 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[records-import] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
