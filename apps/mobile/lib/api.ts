/**
 * Cliente HTTP para hablar con el backend de Nidokey.
 *
 * Lee la URL de EXPO_PUBLIC_API_URL (env de Expo, expuesta al cliente).
 * Si hay token de sesión, lo añade como `Authorization: Bearer`.
 */
import { getItem } from "./secure-store";

/**
 * URL base del backend de Nidokey — ORIGEN, sin "/api".
 * Cada endpoint incluye su ruta completa, p.ej. api("/api/auth/mobile/request").
 *
 * Resolución por prioridad:
 *  1. EXPO_PUBLIC_API_URL → override explícito sin recompilar. Úsalo para
 *     apuntar Expo Go a producción, o a tu IP local de LAN en desarrollo:
 *       EXPO_PUBLIC_API_URL=https://nidokey.es
 *       EXPO_PUBLIC_API_URL=http://192.168.1.77:4200   (← tu IP local en dev)
 *  2. Build de producción (__DEV__ === false) → https://nidokey.es (HTTPS).
 *  3. Desarrollo (Expo Go / Metro, __DEV__ === true) → IP local de LAN.
 *
 * Producción SIEMPRE por HTTPS; el http:// solo aplica al dev server en LAN.
 */
const PROD_URL = "https://nidokey.es";
// ⚠️ DEV: cambia esta IP por la de tu máquina en la LAN (ipconfig / ifconfig),
// o mejor define EXPO_PUBLIC_API_URL para no recompilar.
const DEV_URL = "http://192.168.1.77:4200";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_URL : PROD_URL);
export const TOKEN_KEY = "nidokey.mobile.token";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export type ApiOptions = RequestInit & { skipAuth?: boolean };

/**
 * Construye el header Authorization con el JWT móvil emitido por el servidor.
 * Reutilizable; devuelve {} si no hay token.
 */
export function getAuthHeaders(mobileJwt?: string | null): { Authorization?: string } {
  return mobileJwt ? { Authorization: `Bearer ${mobileJwt}` } : {};
}

async function authHeader(): Promise<{ Authorization?: string }> {
  const token = await getItem(TOKEN_KEY);
  return getAuthHeaders(token);
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = opts;
  const auth = skipAuth ? {} : await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) {
    const msg =
      (body as { error?: string })?.error ??
      (typeof body === "string" ? body : `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

// ─── Endpoints auth ───

export async function authRequestOtp(email: string): Promise<{ ok: true }> {
  return api("/api/auth/mobile/request", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

export async function authVerifyOtp(
  email: string,
  code: string
): Promise<{ token: string; user: { id: string; email: string; name: string | null } }> {
  return api("/api/auth/mobile/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
    skipAuth: true,
  });
}
