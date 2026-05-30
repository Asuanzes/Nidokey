import { NextRequest, NextResponse } from "next/server";
import { ImportListingInput, importListing } from "@/lib/import-listing";
import { extractTokenFromRequest, resolveUserFromToken } from "@/lib/api-token";
import { verifyMobileJwt } from "@/lib/mobile-jwt";

// CORS: el bookmarklet se ejecuta en idealista.com / fotocasa.es / …
// Mantenemos CORS abierto a *, pero exigimos token Bearer en Authorization.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // 1. Validar token: acepta bs_ API tokens (bookmarklet) y JWT móvil
  let ownerId: string | null = null;

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (bearerToken) {
    // Intentar primero como JWT móvil (iss: buysell-mobile)
    try {
      const verified = await verifyMobileJwt(bearerToken);
      if (verified) ownerId = verified.userId;
    } catch { /* no es JWT móvil */ }

    // Si no, intentar como bs_ API token
    if (!ownerId) {
      ownerId = await resolveUserFromToken(bearerToken);
    }
  } else {
    // ?token= query param (bookmarklet legacy)
    const token = extractTokenFromRequest(req);
    if (token) ownerId = await resolveUserFromToken(token);
  }

  if (!ownerId) {
    return NextResponse.json(
      { error: "Token inválido o revocado" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 2. Parsear payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: CORS_HEADERS });
  }
  const parsed = ImportListingInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", issues: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Importar atribuido al owner
  try {
    const result = await importListing(parsed.data, { ownerId });
    return NextResponse.json(result, { status: result.created ? 201 : 200, headers: CORS_HEADERS });
  } catch (err) {
    const e = err as Error & { code?: string; meta?: unknown };
    console.error("[import-listing] error:", err);
    return NextResponse.json(
      {
        error: e.message || "Error interno",
        code: e.code ?? null,
        meta: e.meta ?? null,
        name: e.name ?? null,
        stack: e.stack?.split("\n").slice(0, 5).join("\n") ?? null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
