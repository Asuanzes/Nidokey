/**
 * Valida las traducciones del móvil: cada idioma debe tener las MISMAS claves que
 * el español (`es`, fuente de verdad). Avisa de claves faltantes/sobrantes y sale
 * con código ≠0 si a algún idioma le faltan claves (útil en pre-build/CI).
 *
 * Uso: npm run i18n:validate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LOCALES = join(process.cwd(), "apps", "mobile", "locales");
const SOURCE = "es";

type Json = Record<string, unknown>;

function read(lang: string): Json {
  return JSON.parse(readFileSync(join(LOCALES, lang, "translation.json"), "utf8")) as Json;
}

/** Aplana a claves de hoja: { a: { b: "x" } } → ["a.b"]. */
function flatten(obj: Json, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flatten(v as Json, key));
    else out.push(key);
  }
  return out;
}

const langs = readdirSync(LOCALES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((l) => l !== SOURCE);

const source = new Set(flatten(read(SOURCE)));
console.log(`Fuente ${SOURCE}: ${source.size} claves\n`);

let failed = false;
for (const lang of langs) {
  const set = new Set(flatten(read(lang)));
  const missing = [...source].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !source.has(k));
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✓ ${lang}: OK (${set.size} claves)`);
    continue;
  }
  if (missing.length) {
    failed = true;
    console.log(`✗ ${lang}: faltan ${missing.length} → ${missing.join(", ")}`);
  }
  if (extra.length) {
    console.log(`· ${lang}: sobran ${extra.length} (no en ${SOURCE}) → ${extra.join(", ")}`);
  }
}

if (failed) {
  console.log("\n❌ Hay claves sin traducir. Complétalas o ejecuta i18n:translate.");
  process.exit(1);
}
console.log("\n✅ Todas las traducciones están completas.");
