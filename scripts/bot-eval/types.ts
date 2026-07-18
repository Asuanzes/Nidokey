import type { Turn, AgentToolCall } from "../../src/lib/chat/agent";

/** Un fixture: respuesta fija (string JSON) o función de los args de la tool. */
export type Fixture = string | ((args: Record<string, unknown>) => string);

export type EvalRole = "onboarding" | "consulta" | "accion" | "adversarial";

export type EvalCase = {
  id: string; // "acc-del-02"
  role: EvalRole;
  /** Incluido en el subset barato pre-deploy (npm run bot:eval:smoke). */
  smoke?: boolean;
  /** El último turno SIEMPRE es "user" (es el mensaje al que responde el bot). */
  history: Turn[];
  /** Overrides por nombre de tool; lo no listado cae al mundo por defecto de fixtures.ts. */
  fixtures?: Record<string, Fixture>;
  expect: {
    /** Tools que DEBEN llamarse, en orden (subset-match de args). */
    tools?: { name: string; args?: Record<string, unknown> }[];
    /** Tools que NO deben llamarse ("all" = ninguna). */
    forbidTools?: string[] | "all";
    mustMatch?: RegExp[]; // sobre el texto final
    mustNotMatch?: RegExp[];
    maxChars?: number; // default 800 (MAX_REPLY_CHARS de producción)
  };
  /** Rúbrica para el juez LLM (1-3 frases); sin ella el caso no se juzga. */
  judge?: string;
};

export type AssertFail = { check: string; detail: string };

export type JudgeVerdict = { score: number; pass: boolean; reason: string };

export type RunAttempt = {
  text: string | null;
  provider: string;
  toolCalls: AgentToolCall[];
  fails: AssertFail[];
  judge?: JudgeVerdict;
  costUsd: number;
};

export type CaseResult = {
  id: string;
  role: EvalRole;
  attempts: RunAttempt[];
  /** pass = TODAS las repeticiones sin fails deterministas (el juez informa, no bloquea). */
  pass: boolean;
};

export type RunReport = {
  timestamp: string;
  gitRev: string;
  promptHash: string; // sha256 del BOT_SYSTEM_PROMPT — ata cada run a su versión del prompt
  provider: string;
  n: number;
  results: CaseResult[];
  byRole: Record<string, { total: number; passed: number }>;
  totalCostUsd: number;
  judgeAvg: number | null;
};
