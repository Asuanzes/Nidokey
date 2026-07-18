import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../src/lib/db";

/**
 * Exporta las conversaciones REALES con el bot @Nidokey a un JSONL local para
 * minar casos de eval. SOLO LECTURA contra la BBDD. La salida es LOCAL y está
 * gitignorada (el repo es público): los casos curados se transcriben a mano a
 * cases/reales.local.ts con datos ficticios equivalentes.
 *
 * Uso: npm run bot:export [-- --redact]
 * Formato por línea: { convoId, turns: [{ role, text, at }] }
 */
const BOT_ID = "nidokey-bot";
const redact = process.argv.includes("--redact");

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE_RE = /\b\d{9,}\b/g;

function clean(s: string): string {
  if (!redact) return s;
  return s.replace(EMAIL_RE, "<email>").replace(PHONE_RE, "<tel>");
}

async function main() {
  const convos = await prisma.conversation.findMany({
    where: { kind: "DIRECT", participants: { some: { userId: BOT_ID } } },
    select: { id: true },
  });
  console.log(`${convos.length} DMs con el bot`);
  const lines: string[] = [];
  let msgTotal = 0;
  for (const c of convos) {
    const msgs = await prisma.chatMessage.findMany({
      where: { conversationId: c.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { senderId: true, body: true, createdAt: true, kind: true },
    });
    const turns = msgs
      .map((m) => ({
        role: m.senderId === BOT_ID ? "bot" : "user",
        text: clean(m.body ?? `(${m.kind.toLowerCase()})`),
        at: m.createdAt.toISOString(),
      }))
      .filter((t) => t.text);
    if (turns.length < 2) continue; // solo el saludo → nada que minar
    msgTotal += turns.length;
    lines.push(JSON.stringify({ convoId: c.id, turns }));
  }
  const HERE = dirname(fileURLToPath(import.meta.url));
  const outDir = join(HERE, "real");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `convos-${new Date().toISOString().slice(0, 10)}.jsonl`);
  writeFileSync(out, lines.join("\n") + (lines.length ? "\n" : ""));
  console.log(`${lines.length} conversaciones (${msgTotal} mensajes) → ${out}${redact ? " [redactado]" : ""}`);

  // Pistas de curación: respuestas de eco = la cascada LLM falló ese día.
  const echoes = lines.filter((l) => l.includes("🪺 Recibí:")).length;
  if (echoes) console.log(`⚠ ${echoes} conversaciones contienen respuestas de ECO (cascada caída) — candidatas a caso`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
