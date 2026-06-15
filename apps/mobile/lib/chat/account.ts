import { api } from "@/lib/api";

/** Perfil + alias del usuario (endpoints /api/account). */
export type Account = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

export const getAccount = () => api<Account>("/api/account");

export const updateAccount = (input: {
  name?: string | null;
  username?: string | null;
  image?: string | null;
  onboardingCompleted?: boolean;
}) =>
  api<Account>("/api/account", { method: "PATCH", body: JSON.stringify(input) });

/**
 * Sube la foto de perfil: presign → PUT directo a R2 → PATCH con la key.
 * Devuelve el perfil actualizado (image ya como URL servible).
 */
export async function setAvatar(file: { uri: string; mime: string }): Promise<Account> {
  const blob = await (await fetch(file.uri)).blob();
  const mime = (file.mime || blob.type || "image/jpeg").toLowerCase();
  const presign = await api<{ key: string; uploadUrl: string }>("/api/account/avatar", {
    method: "POST",
    body: JSON.stringify({ mime, sizeBytes: blob.size }),
  });
  const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
  if (!put.ok) throw new Error(`Subida fallida (${put.status})`);
  return updateAccount({ image: presign.key });
}

export const removeAvatar = () => updateAccount({ image: null });

export const checkUsername = (u: string) =>
  api<{ ok: boolean; available: boolean; reason: "format" | "reserved" | "taken" | null }>(
    `/api/account/username-available?u=${encodeURIComponent(u)}`
  );
