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
import { chatSocket } from "./chat/socket";
import { setOnboardingDone, ONBOARDING_DONE_KEY } from "./onboarding";

export type User = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  needsOnboarding: boolean;
};

type AuthState =
  | { kind: "loading" }
  | { kind: "unauthed" }
  | { kind: "authed"; token: string; user: User };

type AuthContextValue = {
  state: AuthState;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "nidokey.mobile.user";

function normalizeStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Partial<User>;
  if (typeof u.id !== "string" || typeof u.email !== "string") return null;
  return {
    id: u.id,
    email: u.email,
    name: typeof u.name === "string" ? u.name : null,
    username: typeof u.username === "string" ? u.username : null,
    needsOnboarding: typeof u.needsOnboarding === "boolean" ? u.needsOnboarding : false,
  };
}

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
          const user = normalizeStoredUser(JSON.parse(userJson));
          if (!user) throw new Error("invalid user");
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
    if (!user.needsOnboarding) {
      await setOnboardingDone();
    }
    await Promise.all([
      setItem(TOKEN_KEY, token),
      setItem(USER_KEY, JSON.stringify(user)),
    ]);
    setState({ kind: "authed", token, user });
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    // El updater SOLO calcula el nuevo estado y captura el user resultante; NO
    // dispara efectos async dentro (React puede invocar el updater dos veces en
    // dev/StrictMode → escrituras duplicadas). Persistimos UNA vez, fuera.
    let nextUser: User | null = null;
    setState((current) => {
      if (current.kind !== "authed") return current;
      nextUser = { ...current.user, needsOnboarding: false };
      return { ...current, user: nextUser };
    });
    await Promise.all([
      setOnboardingDone(),
      nextUser ? setItem(USER_KEY, JSON.stringify(nextUser)) : Promise.resolve(),
    ]);
  }, []);

  const logout = useCallback(async () => {
    // Baja del push ANTES de borrar el token (la llamada necesita el JWT).
    await unregisterPush();
    chatSocket.disconnect();
    // Borrar también el flag local de onboarding: va atado al ciclo de la sesión,
    // para que una cuenta NUEVA en el mismo dispositivo no herede "done".
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY), deleteItem(ONBOARDING_DONE_KEY)]);
    setState({ kind: "unauthed" });
  }, []);

  // Con sesión: registrar push (idempotente) y abrir el socket de tiempo real.
  useEffect(() => {
    if (state.kind === "authed") {
      void registerForPush();
      chatSocket.connect();
    }
  }, [state.kind]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, requestOtp, verifyOtp, markOnboardingComplete, logout }),
    [state, requestOtp, verifyOtp, markOnboardingComplete, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
