import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUserId } from "@/lib/auth-helpers";
import { getOrCreateUserToken } from "@/lib/api-token";

type Ctx = { params: Promise<{ portal: string }> };

const VALID_PORTALS = new Set([
  "idealista", "fotocasa", "pisos", "habitaclia",
  "yaencontre", "thinkspain", "indomio",
]);

/**
 * Sirve el userscript con el token del usuario logueado embebido.
 *
 * Tampermonkey detecta este endpoint como un .user.js por la extensión en la URL
 * (`/api/bookmarklet/idealista.user.js`).
 *
 * El script estático en /public/bookmarklet/ tiene `const API_TOKEN = "..."`
 * como placeholder; aquí lo reemplazamos por el token real.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { portal: raw } = await params;
  // Acepta tanto "idealista" como "idealista.user.js"
  const portal = raw.replace(/\.user\.js$/i, "").toLowerCase();
  if (!VALID_PORTALS.has(portal)) {
    return NextResponse.json({ error: "Portal no soportado" }, { status: 404 });
  }

  const userId = await requireUserId();
  const token = await getOrCreateUserToken(userId);

  const filePath = path.join(process.cwd(), "public", "bookmarklet", `buysell-${portal}.user.js`);
  let src: string;
  try {
    src = await readFile(filePath, "utf8");
  } catch {
    return NextResponse.json({ error: "Userscript no encontrado" }, { status: 404 });
  }

  // Inyectar token + cabecera Authorization en el bloque inicial del userscript.
  // Insertamos un comentario marcador + las dos constantes inmediatamente tras
  // el `(function () { "use strict";`.
  const injected = src.replace(
    /(\(function\s*\(\)\s*\{\s*"use strict";)/,
    `$1
  // Inyectado dinámicamente por /api/bookmarklet/${portal}
  const BUYSELL_TOKEN = ${JSON.stringify(token)};
`
  );

  // Y modificamos el GM_xmlhttpRequest para que mande Authorization: Bearer.
  // Asumimos que el script tiene `headers: { "Content-Type": "application/json" }`.
  const withAuth = injected.replace(
    /headers:\s*\{\s*"Content-Type":\s*"application\/json"\s*\}/g,
    `headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BUYSELL_TOKEN }`
  );

  return new NextResponse(withAuth, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      // Para que Tampermonkey detecte la actualización siempre que descarga
      "X-Generated-For": userId,
    },
  });
}
