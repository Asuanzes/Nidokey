import { ONBOARDING_CASES } from "./onboarding";
import { CONSULTA_CASES } from "./consultas";
import { ACCION_CASES } from "./acciones";
import { ADVERSARIAL_CASES } from "./adversarial";
import { MINADO_CASES } from "./minados";
import type { EvalCase } from "../types";

/** Batería commiteable: sintética + minados re-autorados (sin datos personales).
 *  Los casos reales SIN genericizar viven en reales.local.ts (GITIGNORED) y los
 *  añade run.ts si existen. */
export const ALL_CASES: EvalCase[] = [
  ...ONBOARDING_CASES,
  ...CONSULTA_CASES,
  ...ACCION_CASES,
  ...ADVERSARIAL_CASES,
  ...MINADO_CASES,
];
