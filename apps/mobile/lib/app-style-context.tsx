import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getItem, setItem } from "@/lib/secure-store";

/**
 * Estilo VISUAL de la app:
 * - "vintage": look actual, acero y latón envejecido.
 * - "operativo": más compacto, sobrio y de lectura rápida.
 * - "2100": futurista, fondos oscuros y acentos neón.
 *
 * Replica el patrón de `lib/theme.tsx` y `lib/i18n/language-context.tsx`:
 * persistido en SecureStore (Keychain / EncryptedSharedPreferences), con
 * fallback a localStorage en web — la convención de "prefs-storage" del
 * proyecto. El default es "vintage" para no romper el aspecto actual.
 *
 * Bloque B (este): solo persiste y expone el estado a través del hook.
 * Bloque C ramifica `ScreenBackground` según `appStyle`. Hasta entonces el
 * picker conmuta y guarda, pero no hay efecto visual.
 */

const KEY = "nidokey.appStyle";

export type AppStyle = "vintage" | "operativo" | "2100";

type Ctx = {
  appStyle: AppStyle;
  setAppStyle: (s: AppStyle) => void;
};

const AppStyleContext = createContext<Ctx>({
  appStyle: "vintage",
  setAppStyle: () => {},
});

function parse(value: string | null | undefined): AppStyle {
  return value === "2100" || value === "operativo" || value === "vintage"
    ? value
    : "vintage";
}

export function AppStyleProvider({ children }: { children: ReactNode }) {
  const [appStyle, setAppStyleState] = useState<AppStyle>("vintage");

  // Hidratar la preferencia guardada.
  useEffect(() => {
    getItem(KEY)
      .then((v) => setAppStyleState(parse(v)))
      .catch(() => {});
  }, []);

  const setAppStyle = (next: AppStyle) => {
    setAppStyleState(next);
    void setItem(KEY, next);
  };

  const value = useMemo<Ctx>(() => ({ appStyle, setAppStyle }), [appStyle]);
  return <AppStyleContext.Provider value={value}>{children}</AppStyleContext.Provider>;
}

export const useAppStyle = (): Ctx => useContext(AppStyleContext);
