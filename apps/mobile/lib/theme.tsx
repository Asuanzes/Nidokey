import { createContext, useContext } from "react";
import type { AppStyle } from "@/lib/app-style-context";

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

/**
 * Paleta "2100" (visual alternativo). Mismo SHAPE que `T` para que el
 * `useTheme()` y todas las primitivas (Card, Chip, Section, …) sigan funcionando
 * sin condicionales en el sitio de uso. La rama del estilo vive en el
 * `ThemeProvider` (Bloque D): cuando `appStyle === "2100"` el provider entrega
 * `T2100`/`TD2100` en lugar de `T`/`TD`. Aquí solo se DECLARA la paleta; la
 * conmutación NO entra en este lote (Bloque C solo aplica el cambio al fondo).
 *
 * Referencia visual: fondos cálidos oscuros con líneas onduladas color
 * melocotón/naranja y formas angulares magenta/rosa + naranja, futuristas pero
 * vibrantes. La variante clara mantiene la misma familia con menos saturación.
 */
export const T2100: Theme = {
  bg: "#FFF5EC",        // crema cálida
  surface: "#FFFFFF",
  border: "#F0DDC9",
  text: "#1B1421",      // ciruela muy oscuro
  textMuted: "#5D4F5E",
  textSubtle: "#90839A",
  // Primario = magenta cálido (acción).
  primary: "#D44D7C",
  primarySoft: "#FCE3EA",
  primaryFg: "#FFFFFF",
  sourceBlue: "#7D4690",
  // Acento = melocotón/naranja para énfasis.
  accent: "#F08A4B",
  accentSoft: "#FBE2CE",
  dangerFg: "#C04A4A",
  dangerSoft: "#FAD9D6",
  imagePlaceholder: "#F7E6D5",
  scoreBg: "#F7E6D5",
  surfaceSoft: "#FFF0E2",
  surfaceRaised: "#FFFFFF",
  bgTop: "#FFE9D5",
  bgBottom: "#FBD3D7",
  overlay: "rgba(27,20,33,0.42)",
  space: { ...T.space },
  radii: { ...T.radii, lg: 20, xl: 28 },
  type: { ...T.type },
  elevation: { ...T.elevation },
};

export const TD2100: Theme = {
  bg: "#100A18",        // ciruela muy oscuro casi negro
  surface: "#1B1024",
  border: "#2E1E3A",
  text: "#F5E3D2",      // crema melocotón muy claro
  textMuted: "#C2A9B7",
  textSubtle: "#8B7188",
  // Primario = magenta cálido (acción).
  primary: "#F26D9A",
  primarySoft: "#3A1C2E",
  primaryFg: "#1B1421",
  sourceBlue: "#C58CD6",
  // Acento = melocotón/naranja brillante.
  accent: "#FFB994",
  accentSoft: "#3A1E12",
  dangerFg: "#F58D7A",
  dangerSoft: "#3A1A18",
  imagePlaceholder: "#22152C",
  scoreBg: "#22152C",
  surfaceSoft: "#190E22",
  surfaceRaised: "#23142F",
  bgTop: "#1A0E24",
  bgBottom: "#0B0610",
  overlay: "rgba(8,4,12,0.6)",
  space: { ...TD.space },
  radii: { ...TD.radii, lg: 20, xl: 28 },
  type: { ...TD.type },
  elevation: {
    ...TD.elevation,
    sm: { ...TD.elevation.sm, shadowColor: "#F26D9A", shadowOpacity: 0.24 },
    md: { ...TD.elevation.md, shadowColor: "#F26D9A", shadowOpacity: 0.3 },
    lg: { ...TD.elevation.lg, shadowColor: "#F26D9A", shadowOpacity: 0.36 },
  },
};

export function pickTheme(appStyle: AppStyle, dark: boolean): Theme {
  if (appStyle === "2100") return dark ? TD2100 : T2100;
  return dark ? TD : T;
}

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
