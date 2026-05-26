import { createContext, useContext } from "react";

export const T = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  border: "#E8E6E1",
  text: "#1A1A18",
  textMuted: "#6B6862",
  textSubtle: "#9A9690",
  primary: "#3A5F8A",
  primarySoft: "#EAEFF6",
  primaryFg: "#FAFAF7",
  accent: "#C49A4D",
  accentSoft: "#F7F0E3",
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
  primary: "#6A9FD0",
  primarySoft: "#1A2A3A",
  primaryFg: "#F0EFEA",
  accent: "#D4AA5D",
  accentSoft: "#262012",
  dangerFg: "#D06868",
  dangerSoft: "#2E1818",
  imagePlaceholder: "#252523",
  scoreBg: "#252523",
};

export type Theme = typeof T;

type ThemeCtx = {
  dark: boolean;
  th: Theme;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeCtx>({
  dark: false,
  th: T,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);
