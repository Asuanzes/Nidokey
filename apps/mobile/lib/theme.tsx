import { createContext, useContext } from "react";

export const T = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  border: "#E8E6E1",
  text: "#1A1A18",
  textMuted: "#6B6862",
  textSubtle: "#9A9690",
  // `primary` = bronce (= accent): el azul se reserva SOLO para el botón "+"
  // de Importar (FAB_BG fijo en (tabs)/_layout). Así no hay azul suelto.
  primary: "#B87333",
  primarySoft: "#F5EDE3",
  primaryFg: "#FAFAF7",
  // Azul SOLO para la fuente del registro (portal inmobiliario / plataforma de
  // empleo) como atribución. El resto del azul sigue reservado al FAB.
  sourceBlue: "#3A5F8A",
  accent: "#B87333",
  accentSoft: "#F5EDE3",
  dangerFg: "#A23E3E",
  dangerSoft: "#F6E5E5",
  imagePlaceholder: "#F4F3EE",
  scoreBg: "#f3f3f3",
};

export const TD = {
  bg: "#141413",
  surface: "#1E1E1C",
  border: "#333331",
  text: "#F0EFEA",
  textMuted: "#A8A5A0",
  textSubtle: "#6B6862",
  // `primary` = bronce (= accent); azul reservado al botón "+" de Importar.
  primary: "#CC8844",
  primarySoft: "#2A1A08",
  primaryFg: "#F0EFEA",
  // Azul aclarado para que la fuente del registro se lea sobre fondo oscuro.
  sourceBlue: "#7AA6D8",
  accent: "#CC8844",
  accentSoft: "#2A1A08",
  dangerFg: "#D06868",
  dangerSoft: "#2E1818",
  imagePlaceholder: "#252523",
  scoreBg: "#252523",
};

export type Theme = typeof T;

/** Modo de tema: "auto" sigue el sistema; "light"/"dark" fijan el tema. */
export type ThemeMode = "auto" | "light" | "dark";

type ThemeCtx = {
  dark: boolean;
  th: Theme;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  /** Atajo (claro↔oscuro) que conservamos por compatibilidad. */
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeCtx>({
  dark: false,
  th: T,
  themeMode: "auto",
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);
