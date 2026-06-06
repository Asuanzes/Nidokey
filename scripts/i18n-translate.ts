/**
 * Genera BORRADORES de traducción para las claves que falten en un idioma,
 * tomando el español (`es`) como fuente. Traducción automática (DeepL o Google) →
 * son borradores: requieren revisión humana (el idioma se marca como
 * `translationQuality: "automatic"` en lib/i18n/languages.ts).
 *
 * Uso:
 *   GOOGLE_TRANSLATE_API_KEY=... npm run i18n:translate -- --lang en,pt-BR --api google
 *   DEEPL_API_KEY=...            npm run i18n:translate -- --lang de --api deepl
 *
 * Solo rellena las claves FALTANTES (no pisa traducciones existentes/revisadas).
 * Crea el archivo del idioma si no existe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES = join(process.cwd(), "apps", "mobile", "locales");
const SOURCE = "es";

type Json = Record<string, unknown>;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const langs = (arg("lang") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const api = (arg("api") ?? "google").toLowerCase();
if (langs.length === 0) {
  console.error("Falta --lang (ej. --lang en,pt-BR). Idiomas a traducir, separados por coma.");
  process.exit(1);
}

function read(lang: string): Json {
  const p = join(LOCALES, lang, "translation.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Json) : {};
}
function write(lang: string, data: Json) {
  const dir = join(LOCALES, lang);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "translation.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Recorre el árbol fuente; por cada hoja que falte en target la traduce. */
async function fill(src: Json, tgt: Json, translate: (s: string) => Promise<string>): Promise<number> {
  let n = 0;
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (typeof tgt[k] !== "object" || tgt[k] == null) tgt[k] = {};
      n += await fill(v as Json, tgt[k] as Json, translate);
    } else if (typeof v === "string" && typeof tgt[k] !== "string") {
      tgt[k] = await translate(v);
      n++;
    }
  }
  return n;
}

/** DeepL API (api-free.deepl.com / api.deepl.com). Devuelve el texto traducido. */
async function deepl(text: string, target: string): Promise<string> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("Falta DEEPL_API_KEY");
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const res = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ text, source_lang: "ES", target_lang: target.split("-")[0]!.toUpperCase() }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { translations: { text: string }[] };
  return json.translations[0]?.text ?? text;
}

/** Google Cloud Translation v2. */
async function google(text: string, target: string): Promise<string> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error("Falta GOOGLE_TRANSLATE_API_KEY");
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "es", target: target.split("-")[0], format: "text" }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { translations: { translatedText: string }[] } };
  return json.data.translations[0]?.translatedText ?? text;
}

async function main() {
  const src = read(SOURCE);
  const translate = api === "deepl" ? deepl : google;
  for (const lang of langs) {
    const tgt = read(lang);
    const n = await fill(src, tgt, (s) => translate(s, lang));
    write(lang, tgt);
    console.log(`✓ ${lang}: ${n} claves traducidas (borrador ${api}). Revisar antes de publicar.`);
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
