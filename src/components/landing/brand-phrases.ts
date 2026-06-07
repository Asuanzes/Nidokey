// Frase de marca "Tu nido, tu key." en 18 idiomas. Solo se traduce el posesivo
// ("tu"); las palabras de marca "nido" y "key" se mantienen intactas (salvo donde
// el idioma usa otro alfabeto). Se reparten 9 a cada lado del contenido central.
// Etiquetas en autónimo nativo (cada idioma escrito en su propia lengua).

export type BrandPhrase = {
  /** código BCP-47 corto, solo como key estable */
  code: string;
  /** nombre del idioma en su propia lengua */
  label: string;
  /** la frase de marca */
  slogan: string;
};

export const BRAND_PHRASES_LEFT: BrandPhrase[] = [
  { code: "es", label: "Español", slogan: "Tu nido, tu key." },
  { code: "en", label: "English", slogan: "Your nido, your key." },
  { code: "fr", label: "Français", slogan: "Ton nido, ta key." },
  { code: "de", label: "Deutsch", slogan: "Dein nido, deine key." },
  { code: "it", label: "Italiano", slogan: "Il tuo nido, la tua key." },
  { code: "pt", label: "Português", slogan: "O teu nido, a tua key." },
  { code: "nl", label: "Nederlands", slogan: "Je nido, je key." },
  { code: "pl", label: "Polski", slogan: "Twój nido, twoja key." },
  { code: "ru", label: "Русский", slogan: "Твой nido, твоя key." },
];

export const BRAND_PHRASES_RIGHT: BrandPhrase[] = [
  { code: "ar", label: "العربية", slogan: "تو نيدو، تو كِي." },
  { code: "zh", label: "中文", slogan: "你的 nido, 你的 key." },
  { code: "ja", label: "日本語", slogan: "あなたの nido、あなたの key." },
  { code: "ko", label: "한국어", slogan: "너의 nido, 너의 key." },
  { code: "hi", label: "हिन्दी", slogan: "तुम्हारा nido, तुम्हारी key." },
  { code: "tr", label: "Türkçe", slogan: "Senin nido, senin key." },
  { code: "sv", label: "Svenska", slogan: "Din nido, din key." },
  { code: "no", label: "Norsk", slogan: "Din nido, din key." },
  { code: "da", label: "Dansk", slogan: "Din nido, din key." },
];
