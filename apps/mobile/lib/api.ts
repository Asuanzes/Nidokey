/**
 * Cliente HTTP para hablar con el backend de Nidokey.
 *
 * Lee la URL de EXPO_PUBLIC_API_URL (env de Expo, expuesta al cliente).
 * Si hay token de sesión, lo añade como `Authorization: Bearer`.
 */
import { getItem } from "./secure-store";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.77:4200";
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

async function authHeader(): Promise<Record<string, string>> {
  const token = await getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
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
