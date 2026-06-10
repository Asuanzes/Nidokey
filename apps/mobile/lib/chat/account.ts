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

export const updateAccount = (input: { name?: string | null; username?: string | null }) =>
  api<Account>("/api/account", { method: "PATCH", body: JSON.stringify(input) });

export const checkUsername = (u: string) =>
  api<{ ok: boolean; available: boolean; reason: "format" | "reserved" | "taken" | null }>(
    `/api/account/username-available?u=${encodeURIComponent(u)}`
  );
