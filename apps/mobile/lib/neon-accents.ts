import type { Theme } from "@/lib/theme";

export type NeonAccentId =
  | "rosa"
  | "azul"
  | "verde"
  | "rojo"
  | "bronce"
  | "cian"
  | "violeta"
  | "ambar";

export const NEON_ACCENTS: Record<NeonAccentId, { light: string; dark: string }> = {
  rosa: { light: "#D44D7C", dark: "#F26D9A" },
  azul: { light: "#3E6BB0", dark: "#5B8FD6" },
  verde: { light: "#2E9E6B", dark: "#46C98C" },
  rojo: { light: "#D24B4B", dark: "#F26D6D" },
  bronce: { light: "#B5803A", dark: "#D9A85A" },
  cian: { light: "#1F9BB0", dark: "#45C7DD" },
  violeta: { light: "#8A4FC2", dark: "#B07FE6" },
  ambar: { light: "#E07B2E", dark: "#F2A24D" },
};

export const NEON_ACCENT_IDS = Object.keys(NEON_ACCENTS) as NeonAccentId[];

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHex(a: string, b: string, amount: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  });
}

export function applyNeonAccent(theme: Theme, accentId: NeonAccentId, dark: boolean): Theme {
  const color = NEON_ACCENTS[accentId]?.[dark ? "dark" : "light"] ?? NEON_ACCENTS.rosa[dark ? "dark" : "light"];
  const soft = mixHex(theme.bg, color, dark ? 0.18 : 0.14);
  const foreground = dark ? theme.primaryFg : "#FFFFFF";

  return {
    ...theme,
    primary: color,
    primaryFg: foreground,
    primarySoft: soft,
    accent: color,
    accentSoft: soft,
    elevation: dark
      ? {
          ...theme.elevation,
          sm: { ...theme.elevation.sm, shadowColor: color },
          md: { ...theme.elevation.md, shadowColor: color },
          lg: { ...theme.elevation.lg, shadowColor: color },
        }
      : theme.elevation,
  };
}
