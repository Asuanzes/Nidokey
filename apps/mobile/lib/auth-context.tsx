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

const USER_KEY = "buysell.mobile.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, userJson] = await Promise.all([getItem(TOKEN_KEY), getItem(USER_KEY)]);
      if (cancelled) return;
      if (token && userJson) {
        try {
          const user = JSON.parse(userJson) as User;
          setState({ kind: "authed", token, user });
          return;
        } catch {}
      }
      setState({ kind: "unauthed" });
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
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY)]);
    setState({ kind: "unauthed" });
  }, []);

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
