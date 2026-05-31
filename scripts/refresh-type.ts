/**
 * Script CLI: refresca el valor de los registros de un tipo.
 * Uso: tsx scripts/refresh-type.ts <type>   (ej. crypto, property)
 *
 * Pensado para GitHub Actions programado (jobs pesados/scraping sin el límite
 * de tiempo de Vercel). Para cripto/mercados normalmente basta el endpoint
 * /api/cron/refresh disparado por cron-job.org.
 */
import type { RecordType } from "@nidokey/shared";
import { refreshType } from "../src/features/sources/refresh";

async function main() {
  const type = (process.argv[2] ?? "crypto") as RecordType;
  console.log(`Refrescando registros de tipo "${type}"…`);
  const t0 = Date.now();
  const summary = await refreshType(type);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Resumen (${dt}s):`, summary);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
