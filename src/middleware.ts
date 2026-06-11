import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth-edge";

/**
 * Middleware. La web es SOLO la landing pública (`/`) + la API (de la que vive la
 * app móvil). Ya no hay subpáginas web → cualquier otra ruta de página redirige a
 * la landing.
 *
 * Rutas públicas (no requieren sesión):
 *   - /                         (landing de presentación + descarga)
 *   - /api/auth/*               (NextAuth + OTP móvil)
 *   - /api/listings/import      (CORS abierto; validación por API token)
 *   - /api/records/import       (validada por requireUserId() en el handler)
 *   - /api/cron/*               (validada por CRON_SECRET en el handler)
 *   - estáticos (_next, favicon, etc.)
 */
const PUBLIC_PATHS = [
  /^\/$/,                             // landing pública de presentación + descarga
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/listings\/import$/,        // validada por token Bearer
  /^\/api\/records\/import$/,         // ingesta unificada; validada por requireUserId() en el handler
  /^\/api\/cron(\/.*)?$/,             // validada por CRON_SECRET en el handler
  /^\/api\/avatar\/[^/]+$/,           // foto de perfil: 302 a URL firmada (expo-image no manda Bearer)
  /^\/_next(\/.*)?$/,
  /^\/favicon\./,
  /^\/icon\./,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // API (la consume la app móvil): si trae Authorization: Bearer la dejamos pasar
  // —la validación real del JWT ocurre en el handler (Node runtime)—; si no, hace
  // falta sesión web válida o devolvemos 401.
  if (pathname.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) return NextResponse.next();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Cualquier otra página: ya no hay subpáginas web → siempre a la landing.
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: [
    /*
     * Aplica a todo excepto:
     *  - rutas estáticas (_next/static, _next/image)
     *  - imágenes (favicon, icon)
     */
    "/((?!_next/static|_next/image|favicon|icon).*)",
  ],
};
