/**
 * Prueba MANUAL de ingesta de empleo (POC Apify). NO escribe en BBDD.
 *
 * Uso:
 *   1) Pon APIFY_TOKEN en .env (o .env.local). NO lo commitees.
 *   2) npm run test-jobs                         (InfoJobs por defecto)
 *      JOBS_TEST_PLATFORM=linkedin npm run test-jobs   (LinkedIn)
 *
 * Lanza una búsqueda pequeña (maxItems=5) e imprime las ofertas normalizadas.
 * Coste esperado: céntimos (LinkedIn ~$0.002).
 */
import { existsSync, readFileSync } from "node:fs";
import { ingestJobs } from "../src/features/sources/jobs/ingest";
import { jobOfferToNormalized, type JobPlatform } from "../src/features/sources/jobs/types";

// tsx no carga .env por sí solo → cargador mínimo (sin dependencias).
function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

async function main() {
  if (!process.env.APIFY_TOKEN) {
    console.error(
      "⚠️  Falta APIFY_TOKEN. Defínelo en .env (o .env.local) y reintenta.\n" +
        "    Lo consigues en Apify Console → Settings → API & Integrations."
    );
    process.exitCode = 1;
    return;
  }

  const platform = (process.env.JOBS_TEST_PLATFORM as JobPlatform) || "infojobs";
  const location = platform === "linkedin" ? "Spain" : "Asturias";
  const params = { keywords: "react", location, maxItems: 5, platforms: [platform] };
  console.log(`Ingesta ${platform} (POC, maxItems=5):`, { keywords: "react", location }, "\n");

  const offers = await ingestJobs(params);
  console.log(`✓ ${offers.length} ofertas\n`);

  offers.forEach((o, i) => {
    console.log(`${i + 1}. ${o.title} · ${o.companyName || "?"} · ${o.location ?? "?"}`);
    console.log(`   ${o.url}`);
    console.log(`   meta:`, jobOfferToNormalized(o).meta);
  });
}

main().catch((e) => {
  console.error("\n✗ Error en la ingesta:", e instanceof Error ? e.message : e);
  console.error(
    "   Pista: cada actor de Apify tiene su esquema de input y su precio. Si es\n" +
      "   error de input, pasa el input exacto vía params.actorInput; si es de\n" +
      "   coste (mínimo > presupuesto), cambia de actor (APIFY_INFOJOBS_ACTOR /\n" +
      "   APIFY_LINKEDIN_ACTOR) o sube maxTotalChargeUsd con cuidado."
  );
  process.exitCode = 1;
});
