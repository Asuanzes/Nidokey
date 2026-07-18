import type { AgentResult } from "../../src/lib/chat/agent";
import type { EvalCase, JudgeVerdict } from "./types";

/**
 * Juez LLM (capa blanda): puntúa calidad/corrección contra la rúbrica del caso.
 * Nunca es gate de seguridad — eso es de asserts.ts. Mismo estilo fetch que
 * callClaude (sin SDK). Modelo aparte configurable por si un día se juzga con
 * Sonnet: ANTHROPIC_MODEL_JUDGE.
 */
const URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL_JUDGE?.trim() || "claude-haiku-4-5-20251001";

const GLOBAL_RUBRIC =
  "Eres juez de calidad del asistente «Nidokey» (app de registros personales). Evalúa SU ÚLTIMA RESPUESTA: " +
  "(a) ¿es factualmente correcta respecto a los DATOS DE TOOLS mostrados (no inventa)?, " +
  "(b) ¿es breve, natural y en español?, (c) ¿guía bien al usuario (pasos o enlace útil)? " +
  'Responde SOLO un JSON: {"score": 1-5, "pass": true|false, "reason": "una frase"} (pass=score>=4).';

export type JudgeOutcome = JudgeVerdict & { costUsd: number };

export async function judgeCase(c: EvalCase, result: AgentResult): Promise<JudgeOutcome | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || !c.judge || !result.text) return null;
  const transcript = c.history.map((t) => `${t.role === "user" ? "USUARIO" : "BOT"}: ${t.text}`).join("\n");
  const tools = result.toolCalls.length
    ? result.toolCalls.map((tc) => `${tc.name}(${JSON.stringify(tc.args)}) → ${tc.result.slice(0, 400)}`).join("\n")
    : "(ninguna)";
  const user =
    `CONVERSACIÓN PREVIA:\n${transcript}\n\nTOOLS EJECUTADAS:\n${tools}\n\n` +
    `RESPUESTA DEL BOT A EVALUAR:\n${result.text}\n\nRÚBRICA DE ESTE CASO: ${c.judge}`;
  const res = await fetch(URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      temperature: 0,
      system: GLOBAL_RUBRIC,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const body = (await res.json()) as any;
  const u = body.usage ?? {};
  const costUsd = ((u.input_tokens ?? 0) * 1 + (u.output_tokens ?? 0) * 5) / 1e6;
  const text: string = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { score: 0, pass: false, reason: `juez sin JSON: ${text.slice(0, 100)}`, costUsd };
  try {
    const v = JSON.parse(jsonMatch[0]) as { score?: number; pass?: boolean; reason?: string };
    return { score: Number(v.score ?? 0), pass: Boolean(v.pass), reason: String(v.reason ?? ""), costUsd };
  } catch {
    return { score: 0, pass: false, reason: `juez JSON inválido: ${text.slice(0, 100)}`, costUsd };
  }
}
