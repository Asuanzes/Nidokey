import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { setFormattingLocale } from "@nidokey/shared";
import { getItem, setItem } from "@/lib/secure-store";
import i18n from "./index";
import { detectDeviceLang, localeForLang, type AppLang } from "./languages";

/**
 * Estado de IDIOMA de la app (preferencia + idioma efectivo), persistido en
 * SecureStore. Replica el patrón de `lib/theme.tsx`. Al cambiar:
 *  - i18n.changeLanguage → react-i18next re-renderiza las pantallas con t().
 *  - setFormattingLocale → moneda/fecha/número se adaptan.
 */

const KEY = "nidokey.language";

/** Preferencia guardada: "auto" sigue al sistema; "es"/"en" lo fijan. */
export type LangPref = "auto" | AppLang;

type Ctx = {
  /** Lo elegido por el usuario ("auto"/"es"/"en"). */
  pref: LangPref;
  /** Idioma efectivo aplicado ("es"/"en"). */
  language: AppLang;
  setLanguage: (pref: LangPref) => void;
};

const LanguageContext = createContext<Ctx>({
  pref: "auto",
  language: "es",
  setLanguage: () => {},
});

function resolve(pref: LangPref): AppLang {
  return pref === "auto" ? detectDeviceLang() : pref;
}

function apply(lang: AppLang) {
  void i18n.changeLanguage(lang);
  setFormattingLocale(localeForLang(lang));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<LangPref>("auto");
  const [language, setLang] = useState<AppLang>(() => resolve("auto"));

  // Hidratar la preferencia guardada y aplicarla.
  useEffect(() => {
    getItem(KEY)
      .then((v) => {
        const p: LangPref = v === "es" || v === "en" || v === "auto" ? v : "auto";
        const eff = resolve(p);
        setPref(p);
        setLang(eff);
        apply(eff);
      })
      .catch(() => {});
  }, []);

  const setLanguage = (next: LangPref) => {
    const eff = resolve(next);
    setPref(next);
    setLang(eff);
    apply(eff);
    void setItem(KEY, next);
  };

  const value = useMemo<Ctx>(() => ({ pref, language, setLanguage }), [pref, language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = (): Ctx => useContext(LanguageContext);
