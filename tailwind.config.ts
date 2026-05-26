import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-sunken": "var(--surface-sunken)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-subtle": "var(--text-subtle)",
        "text-inverse": "var(--text-inverse)",
        accent: "var(--brand-accent)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
          fg: "var(--primary-fg)",
        },
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
        "price-up-bg": "var(--price-up-bg)",
        "price-up-fg": "var(--price-up-fg)",
        "price-down-bg": "var(--price-down-bg)",
        "price-down-fg": "var(--price-down-fg)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "2xl": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em" }],
        "3xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
