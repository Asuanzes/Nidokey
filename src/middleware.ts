import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth-edge";

/**
 * Middleware: redirige a /login cualquier ruta no pública.
 *
 * Rutas públicas (no requieren sesión):
 *   - /login, /login?...
 *   - /api/auth/*               (NextAuth)
 *   - /api/listings/import      (CORS abierto; validación por API token)
 *   - /api/bookmarklet/*        (userscripts dinámicos, usan ?token=)
 *   - estáticos (_next, favicon, etc.)
 */
const PUBLIC_PATHS = [
  /^\/login(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/listings\/import$/,        // validada por token Bearer
  /^\/_next(\/.*)?$/,
  /^\/favicon\./,
  /^\/icon\./,
  // /api/bookmarklet/* SÍ requiere sesión (en él generamos token personal)
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Si la request trae Authorization: Bearer ..., la dejamos pasar.
  // La validación real del JWT móvil ocurre dentro de la API route (en Node
  // runtime, ya que Edge no puede usar jose si depende de Buffer).
  // Si el Bearer es falso, requireUserId() rechazará con 401 desde el handler.
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    // API → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    // Web → redirect a login con callbackUrl
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
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
