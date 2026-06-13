import { createContext, useContext } from "react";

// Design system "acero y latón envejecido" (steel & aged brass).
// Dos acentos distintos, como en el tema de referencia:
//   primary = ACERO (azul) → acciones/superficies principales, FAB, cabeceras.
//   accent  = LATÓN (oro)  → énfasis (títulos destacados, estados activos).
// Coincide con la identidad de marca (#3A5F8A / #C49A4D).
export const T = {
  bg: "#FAF7F1", // off-white cálido
  surface: "#FFFFFF",
  border: "#E7E1D7",
  text: "#29251F", // gris cálido oscuro (no negro puro)
  textMuted: "#6E675C",
  textSubtle: "#9C958A",
  // ACERO como color primario (botones, spinners, tint de cabecera, FAB).
  primary: "#4F7385",
  primarySoft: "#E7EEF1",
  primaryFg: "#FFFFFF",
  // Azul de marca para la atribución de fuente (portal/plataforma).
  sourceBlue: "#3A5F8A",
  // LATÓN como acento de énfasis (distinto del primario).
  accent: "#B5893B",
  accentSoft: "#F4ECDC",
  dangerFg: "#B0503E", // teja
  dangerSoft: "#F6E7E2",
  imagePlaceholder: "#F2EEE7",
  scoreBg: "#F2EEE7",
  surfaceSoft: "#FBF8F2",
  surfaceRaised: "#FFFFFF",
  bgTop: "#FCFAF6",
  bgBottom: "#F2ECE2",
  overlay: "rgba(41,37,31,0.42)",
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  type: {
    eyebrow: 11,
    caption: 12,
    body: 14,
    bodyLg: 16,
    title: 24,
    hero: 30,
  },
  elevation: {
    none: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: "#2B2118",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    md: {
      shadowColor: "#2B2118",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 5,
    },
    lg: {
      shadowColor: "#2B2118",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 9,
    },
  },
};

// Oscuro fiel a la captura: fondo cálido oscuro + texto crema + acentos vivos.
export const TD = {
  bg: "#262320", // carbón cálido (no negro)
  surface: "#322E2A",
  border: "#423D37",
  text: "#EBE7DE", // crema
  textMuted: "#A39C90",
  textSubtle: "#756F65",
  // Acero aclarado para legibilidad sobre fondo oscuro.
  primary: "#6E8B9A",
  primarySoft: "#28333A",
  primaryFg: "#F5F2EC",
  sourceBlue: "#84A9BD",
  // Latón un punto más brillante en oscuro.
  accent: "#CDA45A",
  accentSoft: "#322A1A",
  dangerFg: "#CF7059",
  dangerSoft: "#2F1E1A",
  imagePlaceholder: "#2E2A26",
  scoreBg: "#2E2A26",
  surfaceSoft: "#2B2824",
  surfaceRaised: "#38332E",
  bgTop: "#2B2824",
  bgBottom: "#201D1A",
  overlay: "rgba(12,11,10,0.56)",
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  type: {
    eyebrow: 11,
    caption: 12,
    body: 14,
    bodyLg: 16,
    title: 24,
    hero: 30,
  },
  elevation: {
    none: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 2,
    },
    md: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.26,
      shadowRadius: 16,
      elevation: 5,
    },
    lg: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.32,
      shadowRadius: 26,
      elevation: 9,
    },
  },
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
