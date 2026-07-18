import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent, BOT_SYSTEM_PROMPT } from "../../src/lib/chat/agent";
import { makeToolRunner } from "./fixtures";
import { runAsserts } from "./asserts";
import { judgeCase } from "./judge";
import { buildReport, costOfUsage, printDiff, printReport, sha256 } from "./report";
import { ALL_CASES } from "./cases/index";
import type { CaseResult, EvalCase, RunAttempt, RunReport } from "./types";

/**
 * Runner de evals del agente Nidokey.
 * Uso: node --env-file=.env --import tsx scripts/bot-eval/run.ts [flags]
 *  --only <rol>      solo un rol (onboarding|consulta|accion|adversarial)
 *  --case <id>       solo un caso
 *  --smoke           subset barato (casos marcados smoke)
 *  --judge           añade el juez LLM a los casos con rúbrica
 *  --n <k>           repite cada caso k veces (pass = todas pasan)
 *  --provider <p>    claude (default) | groq
 *  --baseline <p>    compara contra un report previo
 *  --failed <p>      re-ejecuta solo los casos fallados de un report previo
 *  --dry             lista los casos seleccionados y sale (0 llamadas)
 */
const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(HERE, "reports");

async function loadCases(): Promise<EvalCase[]> {
  let cases: EvalCase[] = [...ALL_CASES];
  try {
    // Casos minados de conversaciones reales — fichero LOCAL, gitignored.
    // Especificador no-literal a propósito: el fichero es opcional y tsc no
    // debe exigir que exista (TS2307); tsx lo resuelve en runtime si está.
    const realPath = "./cases/reales.local";
    const real = (await import(realPath)) as { REAL_CASES?: EvalCase[] };
    if (real.REAL_CASES?.length) cases = cases.concat(real.REAL_CASES);
  } catch {
    /* sin casos reales aún */
  }
  const dupes = cases.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) throw new Error(`ids de caso duplicados: ${dupes.join(", ")}`);
  if (opt("case")) cases = cases.filter((c) => c.id === opt("case"));
  if (opt("only")) cases = cases.filter((c) => c.role === opt("only"));
  if (flag("smoke")) cases = cases.filter((c) => c.smoke);
  if (opt("failed")) {
    const prev = JSON.parse(readFileSync(opt("failed")!, "utf8")) as RunReport;
    const failedIds = new Set(prev.results.filter((r) => !r.pass).map((r) => r.id));
    cases = cases.filter((c) => failedIds.has(c.id));
  }
  return cases;
}

async function runCase(c: EvalCase, n: number, provider: "claude" | "groq", useJudge: boolean): Promise<CaseResult> {
  const attempts: RunAttempt[] = [];
  for (let k = 0; k < n; k++) {
    const result = await runAgent(c.history, makeToolRunner(c), { providers: [provider] });
    const fails = runAsserts(c, result);
    let judge;
    let judgeCost = 0;
    if (useJudge && c.judge) {
      try {
        const v = await judgeCase(c, result);
        if (v) {
          judge = { score: v.score, pass: v.pass, reason: v.reason };
          judgeCost = v.costUsd;
        }
      } catch (e) {
        console.warn(`  ⚠ juez falló en ${c.id}:`, e instanceof Error ? e.message : e);
      }
    }
    attempts.push({
      text: result.text,
      provider: result.provider,
      toolCalls: result.toolCalls,
      fails,
      judge,
      costUsd: costOfUsage(result.usage) + judgeCost,
    });
  }
  return { id: c.id, role: c.role, attempts, pass: attempts.every((a) => a.fails.length === 0) };
}

async function main() {
  const cases = await loadCases();
  if (!cases.length) {
    console.error("0 casos seleccionados");
    process.exitCode = 1;
    return;
  }
  if (flag("dry")) {
    for (const c of cases) console.log(`- ${c.id} [${c.role}]${c.smoke ? " (smoke)" : ""}`);
    console.log(`${cases.length} casos (0 llamadas hechas)`);
    return;
  }
  const provider = (opt("provider") ?? "claude") as "claude" | "groq";
  const n = Number(opt("n") ?? 1);
  const useJudge = flag("judge");
  console.log(`▶ ${cases.length} casos · provider=${provider} · n=${n} · juez=${useJudge ? "sí" : "no"}`);

  const results: CaseResult[] = [];
  for (const c of cases) {
    const r = await runCase(c, n, provider, useJudge);
    results.push(r);
    console.log(`${r.pass ? "✅" : "❌"} ${c.id}`);
  }

  const report = buildReport(results, { promptHash: sha256(BOT_SYSTEM_PROMPT), provider, n });
  printReport(report);

  mkdirSync(REPORTS, { recursive: true });
  const stamp = report.timestamp.replace(/[:.]/g, "-");
  writeFileSync(join(REPORTS, `run-${stamp}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(REPORTS, "last.json"), JSON.stringify(report, null, 2));
  console.log(`\nreport → scripts/bot-eval/reports/last.json`);

  const basePath = opt("baseline");
  if (basePath && existsSync(basePath)) {
    printDiff(JSON.parse(readFileSync(basePath, "utf8")) as RunReport, report);
  }
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
