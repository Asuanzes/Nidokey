import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { AgentResult } from "../../src/lib/chat/agent";
import type { CaseResult, RunReport } from "./types";

/** Precios Haiku 4.5 ($/MTok): input 1, output 5, cache read ×0.1, cache write ×1.25. */
export function costOfUsage(u: AgentResult["usage"]): number {
  return (u.input * 1 + u.output * 5 + u.cacheRead * 0.1 + u.cacheWrite * 1.25) / 1e6;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

export function gitRev(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "?";
  }
}

export function buildReport(results: CaseResult[], meta: { promptHash: string; provider: string; n: number }): RunReport {
  const byRole: RunReport["byRole"] = {};
  for (const r of results) {
    byRole[r.role] ??= { total: 0, passed: 0 };
    byRole[r.role].total++;
    if (r.pass) byRole[r.role].passed++;
  }
  const judgeScores = results.flatMap((r) => r.attempts.map((a) => a.judge?.score).filter((s): s is number => s != null));
  return {
    timestamp: new Date().toISOString(),
    gitRev: gitRev(),
    promptHash: meta.promptHash,
    provider: meta.provider,
    n: meta.n,
    results,
    byRole,
    totalCostUsd: results.reduce((s, r) => s + r.attempts.reduce((t, a) => t + a.costUsd, 0), 0),
    judgeAvg: judgeScores.length ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length : null,
  };
}

export function printReport(rep: RunReport): void {
  console.log("");
  for (const r of rep.results) {
    const icon = r.pass ? "✅" : "❌";
    const judge = r.attempts.find((a) => a.judge)?.judge;
    const jtag = judge ? ` juez=${judge.score}/5` : "";
    console.log(`${icon} ${r.id} [${r.role}]${jtag}`);
    if (!r.pass) {
      for (const a of r.attempts) {
        for (const f of a.fails) console.log(`     · ${f.check}: ${f.detail}`);
      }
    }
  }
  console.log("");
  for (const [role, s] of Object.entries(rep.byRole)) {
    console.log(`  ${role.padEnd(12)} ${s.passed}/${s.total} (${Math.round((100 * s.passed) / s.total)}%)`);
  }
  const total = rep.results.length;
  const passed = rep.results.filter((r) => r.pass).length;
  console.log(`  TOTAL        ${passed}/${total} (${Math.round((100 * passed) / total)}%)`);
  if (rep.judgeAvg != null) console.log(`  juez medio   ${rep.judgeAvg.toFixed(2)}/5`);
  console.log(`  coste        $${rep.totalCostUsd.toFixed(4)}  (prompt ${rep.promptHash} @ ${rep.gitRev})`);
}

/** Diff contra un baseline: regresiones (pasaba→falla), arreglos, delta por rol. */
export function printDiff(baseline: RunReport, current: RunReport): void {
  const base = new Map(baseline.results.map((r) => [r.id, r.pass]));
  const regressions = current.results.filter((r) => base.get(r.id) === true && !r.pass);
  const fixes = current.results.filter((r) => base.get(r.id) === false && r.pass);
  const news = current.results.filter((r) => !base.has(r.id));
  console.log(`\n── diff vs baseline (${baseline.promptHash} → ${current.promptHash}) ──`);
  if (regressions.length) console.log(`  🔴 REGRESIONES: ${regressions.map((r) => r.id).join(", ")}`);
  if (fixes.length) console.log(`  🟢 arreglados: ${fixes.map((r) => r.id).join(", ")}`);
  if (news.length) console.log(`  ＋ nuevos: ${news.map((r) => r.id).join(", ")}`);
  if (!regressions.length && !fixes.length) console.log("  sin cambios de pass/fail");
}
