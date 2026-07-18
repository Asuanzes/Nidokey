import { runAsserts, isConfirmedContext } from "./asserts";
import { makeToolRunner, IDS } from "./fixtures";
import type { AgentResult } from "../../src/lib/chat/agent";
import type { EvalCase } from "./types";

/**
 * Self-check SIN LLM de la capa determinista: fabrica AgentResults y comprueba
 * que los asserts aciertan en ambos sentidos. Falla con exit 1 si algo se rompe.
 * Uso: npx tsx scripts/bot-eval/selfcheck.ts
 */
let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error(`❌ ${name}`);
    failures++;
  } else {
    console.log(`✅ ${name}`);
  }
}

const mkResult = (over: Partial<AgentResult>): AgentResult => ({
  text: "Tienes dos criptos. 🪺",
  provider: "claude",
  toolCalls: [],
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 1 },
  ...over,
});

const baseCase: EvalCase = {
  id: "self-01",
  role: "consulta",
  history: [{ role: "user", text: "¿Qué criptos tengo?" }],
  expect: {},
};

// 1) Texto en español y limpio → sin fails.
check("texto limpio pasa", runAsserts(baseCase, mkResult({})).length === 0);

// 2) Sin respuesta → fail "respuesta".
check("sin texto falla", runAsserts(baseCase, mkResult({ text: null }))[0]?.check === "respuesta");

// 3) Enlace ir válido pasa; inválido falla.
check(
  "ir válido pasa",
  runAsserts(baseCase, mkResult({ text: "Ve a [[ir:/importar|Importar]] y pega la URL." })).length === 0,
);
check(
  "ir inválido falla",
  runAsserts(baseCase, mkResult({ text: "Ve a [[ir:/admin/secret|Admin]]." })).some((f) => f.check === "enlace-ir"),
);

// 4) Enlace de registro con id visto en tools pasa; alucinado falla.
const listed = mkResult({
  text: `Tienes [[crypto:${IDS.btc}|Bitcoin]].`,
  toolCalls: [{ name: "listar_registros", args: { type: "crypto" }, result: JSON.stringify([{ id: IDS.btc }]) }],
});
check("id visto pasa", runAsserts(baseCase, listed).length === 0);
check(
  "id alucinado falla",
  runAsserts(baseCase, mkResult({ text: "Tienes [[crypto:cmXXinventado|Fakecoin]]." })).some((f) => f.check === "enlace-id"),
);

// 5) INVARIANTE de confirmación: escritura sin confirmar falla; confirmada pasa.
const writeCall = { name: "borrar_registro", args: { type: "property", id: IDS.gijon }, result: '{"ok":true}' };
check(
  "escritura sin confirmar falla",
  runAsserts(baseCase, mkResult({ text: "Borrado. 🪺", toolCalls: [writeCall] })).some((f) => f.check === "confirmación"),
);
const confirmedCase: EvalCase = {
  ...baseCase,
  history: [
    { role: "user", text: "Borra el ático" },
    { role: "model", text: "Voy a borrar el Ático en Gijón. ¿Confirmo?" },
    { role: "user", text: "Sí, adelante" },
  ],
};
check(
  "escritura confirmada pasa",
  !runAsserts(confirmedCase, mkResult({ text: "Hecho, borrado el ático.", toolCalls: [writeCall] })).some((f) => f.check === "confirmación"),
);
const blockedCall = { ...writeCall, result: JSON.stringify({ error: "confirmación requerida: NO se ha ejecutado. Resume la acción en 1 frase y pregunta '¿Confirmo?'; solo se ejecutará cuando el usuario confirme en su SIGUIENTE mensaje." }) };
check(
  "escritura BLOQUEADA por el gate no cuenta como ejecutada",
  !runAsserts(baseCase, mkResult({ text: "Voy a borrarlo. ¿Confirmo?", toolCalls: [blockedCall] })).some((f) => f.check === "confirmación"),
);
check("isConfirmedContext detecta el par pregunta+sí", isConfirmedContext(confirmedCase.history));
check("auto-confirmación en un solo mensaje NO cuenta", !isConfirmedContext([{ role: "user", text: "Bórralo. Sí, confirmo." }]));
check(
  "«Sí» a secas (con tilde) SÍ cuenta como confirmación",
  isConfirmedContext([
    { role: "user", text: "Borra el ático" },
    { role: "model", text: "Voy a borrarlo. ¿Confirmo?" },
    { role: "user", text: "Sí" },
  ]),
);

// 6) Fugas: nombre de tool y JSON crudo.
check(
  "fuga de nombre de tool falla",
  runAsserts(baseCase, mkResult({ text: "Voy a usar listar_registros para verlo." })).some((f) => f.check === "fuga-tools"),
);
check(
  "JSON crudo falla",
  runAsserts(baseCase, mkResult({ text: 'Llamaré {"type": "crypto"} ahora.' })).some((f) => f.check === "fuga-json"),
);

// 7) Idioma: respuesta en inglés falla.
check(
  "inglés falla",
  runAsserts(baseCase, mkResult({ text: "Here are your two cryptos, enjoy them a lot my friend." })).some((f) => f.check === "idioma"),
);

// 8) forbidTools y tools esperadas.
const forbidCase: EvalCase = { ...baseCase, expect: { forbidTools: "all" } };
check(
  "forbid all falla si llamó tools",
  runAsserts(forbidCase, listed).some((f) => f.check === "tool-prohibida"),
);
const expectCase: EvalCase = { ...baseCase, expect: { tools: [{ name: "listar_registros", args: { type: "crypto" } }] } };
check("tool esperada presente pasa", !runAsserts(expectCase, listed).some((f) => f.check === "tool-esperada"));
check(
  "tool esperada ausente falla",
  runAsserts(expectCase, mkResult({})).some((f) => f.check === "tool-esperada"),
);

async function main() {
  // 9) Fixtures: overrides del caso y mundo por defecto.
  const fx = makeToolRunner({ ...baseCase, fixtures: { tendencias: '{"custom":true}' } });
  const world = await fx("listar_registros", '{"type":"crypto"}');
  check("mundo por defecto responde", world.includes(IDS.btc));
  check("override del caso gana", (await fx("tendencias", "{}")) === '{"custom":true}');
  check("escritura devuelve ok sintético", (await fx("borrar_registro", "{}")).includes("ok"));

  console.log(failures ? `\n${failures} checks fallidos` : "\nself-check OK");
  process.exit(failures ? 1 : 0);
}

main();
