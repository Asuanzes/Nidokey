import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authRequestOtp, authVerifyOtp, TOKEN_KEY } from "./api";
import { getItem, setItem, deleteItem } from "./secure-store";
import { registerForPush, unregisterPush } from "./chat/push";

type User = { id: string; email: string; name: string | null };

type AuthState =
  | { kind: "loading" }
  | { kind: "unauthed" }
  | { kind: "authed"; token: string; user: User };

type AuthContextValue = {
  state: AuthState;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "nidokey.mobile.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      let userJson: string | null = null;
      try {
        [token, userJson] = await Promise.all([getItem(TOKEN_KEY), getItem(USER_KEY)]);
      } catch (e) {
        // SecureStore ilegible (Keychain / EncryptedSharedPreferences). Sin este
        // try/catch la promesa se rechazaba sin manejar y el estado quedaba en
        // "loading" para siempre (app colgada). Lo tratamos como sin sesión.
        if (__DEV__) console.warn("[auth] no se pudo leer SecureStore:", e);
      }
      if (cancelled) return;
      if (token && userJson) {
        try {
          const user = JSON.parse(userJson) as User;
          setState({ kind: "authed", token, user });
          return;
        } catch {
          // user corrupto → cae a limpieza + unauthed (abajo).
        }
      }
      // Sesión ausente, ilegible o a medias (solo token o solo user, o user
      // corrupto): limpiar ambos para no arrastrar un estado inconsistente.
      if (token || userJson) {
        try {
          await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY)]);
        } catch {}
      }
      if (!cancelled) setState({ kind: "unauthed" });
    })();
    return () => { cancelled = true; };
  }, []);

  const requestOtp = useCallback(async (email: string) => {
    await authRequestOtp(email);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const { token, user } = await authVerifyOtp(email, code);
    await Promise.all([
      setItem(TOKEN_KEY, token),
      setItem(USER_KEY, JSON.stringify(user)),
    ]);
    setState({ kind: "authed", token, user });
  }, []);

  const logout = useCallback(async () => {
    // Baja del push ANTES de borrar el token (la llamada necesita el JWT).
    await unregisterPush();
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY)]);
    setState({ kind: "unauthed" });
  }, []);

  // Registrar el token de push cuando hay sesión (idempotente: upsert backend).
  useEffect(() => {
    if (state.kind === "authed") void registerForPush();
  }, [state.kind]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, requestOtp, verifyOtp, logout }),
    [state, requestOtp, verifyOtp, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
