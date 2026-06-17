import { prisma } from "@/lib/db";
import { directKey, messagePreview } from "@/lib/chat/util";
import { sendChatPush } from "@/lib/chat/push";
import { notifyMessage } from "@/lib/chat/gateway";

const MAX_REPLY_CHARS = 800;

/**
 * El asistente "Nidokey" es un participante de chat normal (una fila User), no
 * un caso especial del esquema. Se reconoce por id/username CONSTANTES:
 *  - el id fijo permite enrutar los mensajes hacia el agente,
 *  - el username "nidokey" ya está reservado en username.ts (anti-suplantación).
 * ponytail: sin campo `isBot` en el esquema — el badge "verificado" del front
 * se deriva de `username === NIDOKEY_BOT_USERNAME`, no necesita columna nueva.
 */
export const NIDOKEY_BOT_ID = "nidokey-bot";
export const NIDOKEY_BOT_USERNAME = "nidokey";

/** Crea (idempotente) la fila User del bot. */
export async function ensureNidokeyBot(): Promise<void> {
  await prisma.user.upsert({
    where: { id: NIDOKEY_BOT_ID },
    update: {},
    create: {
      id: NIDOKEY_BOT_ID,
      email: "nido@nidokey.es", // único; el bot no inicia sesión (sin Account)
      name: "Nidokey",
      username: NIDOKEY_BOT_USERNAME,
      emailVerified: new Date(),
    },
    select: { id: true },
  });
}

/**
 * Garantiza (idempotente) el DM 1:1 entre el usuario y el bot, y devuelve su id.
 * Tras la primera vez es un solo findUnique por `directKey`.
 */
export async function ensureBotDm(userId: string): Promise<string | null> {
  if (userId === NIDOKEY_BOT_ID) return null;
  await ensureNidokeyBot();
  const key = directKey(userId, NIDOKEY_BOT_ID);
  const existing = await prisma.conversation.findUnique({
    where: { directKey: key },
    select: { id: true, lastMessageAt: true },
  });
  if (existing) {
    // Sana DMs creados vacíos antes de añadir el saludo (no salían en la lista).
    if (existing.lastMessageAt === null) await seedWelcome(existing.id);
    return existing.id;
  }
  const created = await prisma.conversation.create({
    data: {
      kind: "DIRECT",
      createdById: NIDOKEY_BOT_ID,
      directKey: key,
      participants: {
        create: [
          { userId, role: "MEMBER" },
          { userId: NIDOKEY_BOT_ID, role: "MEMBER" },
        ],
      },
    },
    select: { id: true },
  });
  await seedWelcome(created.id);
  return created.id;
}

/**
 * Saludo inicial para que el DM nazca "no vacío" (con lastMessageAt + preview) y
 * aparezca en la lista. ponytail: sin dedup fuerte — dos bootstraps simultáneos
 * podrían duplicar el saludo (carrera improbable); subir a lock/upsert si pasa.
 */
async function seedWelcome(conversationId: string): Promise<void> {
  const welcome =
    "👋 ¡Hola! Soy Nidokey, tu asistente dentro de la app. Aún estoy aprendiendo: " +
    "pronto podré buscarte registros, importar enlaces y guiarte. Escríbeme lo que necesites.";
  await prisma.chatMessage.create({
    data: { conversationId, senderId: NIDOKEY_BOT_ID, kind: "TEXT", body: welcome },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), lastMessagePreview: messagePreview("TEXT", welcome) },
  });
}

/** ¿La conversación es un DM 1:1 con el bot? (participantes activos = userIds). */
export function isBotDirect(kind: string, participantUserIds: string[]): boolean {
  return kind === "DIRECT" && participantUserIds.includes(NIDOKEY_BOT_ID);
}

/**
 * Responde como Nidokey en la conversación, por el MISMO camino que un humano:
 * crea el mensaje, actualiza el preview y avisa (push + gateway WS). Fase 3 =
 * eco; en la fase 4 el `text` lo generará Gemini. Pensado para correr dentro de
 * `after()` (post-respuesta), así que cualquier fallo es no-bloqueante.
 */
export async function replyAsBot(conversationId: string, text: string): Promise<void> {
  const body = text.slice(0, MAX_REPLY_CHARS);
  const now = new Date();
  const message = await prisma.chatMessage.create({
    data: { conversationId, senderId: NIDOKEY_BOT_ID, kind: "TEXT", body },
    include: { attachments: true },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now, lastMessagePreview: messagePreview("TEXT", body) },
  });
  await Promise.allSettled([sendChatPush(message), notifyMessage(message)]);
}

/** Eco simple, fallback cuando no hay Gemini configurado o la llamada falla. */
export function echoReply(userText: string | null): string {
  const t = (userText ?? "").trim();
  if (!t) return "🪺 Recibí tu mensaje. Pronto podré ayudarte con la app.";
  return `🪺 Recibí: «${t.slice(0, 200)}». (No tengo el modelo configurado ahora mismo.)`;
}

// ── Fase 4: respuesta con Gemini (mismo patrón keyless de llm-extract.ts) ──
// El free tier de Gemini no va en EU → usar la GEMINI_API_KEY del proyecto con
// billing (nidokey-llm) hace que el chat consuma el crédito de Google. Sin Vertex.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const BOT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
const HISTORY_TURNS = 15; // ponytail: ventana fija; subir si hace falta más contexto

const BOT_SYSTEM_PROMPT = [
  "Eres «Nidokey», el asistente integrado en la app Nidokey: un organizador personal con varias categorías (inmuebles, comida, viajes, criptos, mercados, empleos, libros, tendencias y chat).",
  "Hablas en español, cercano y BREVE (2-4 frases). Puedes usar el emoji 🪺 de vez en cuando.",
  "Ayudas a entender y usar la app: cómo importar un registro pegando/compartiendo una URL, qué es la pestaña Duplicados, cómo buscar, qué hace cada categoría, etc.",
  "LÍMITES: por ahora NO ejecutas acciones por tu cuenta (no creas, buscas, borras ni fusionas registros, ni accedes a los datos privados del usuario). Si te lo piden, explícale cómo hacerlo él mismo; pronto podrás hacer algunas acciones.",
  "No inventes funciones ni datos. Si no sabes algo, dilo.",
].join("\n");

type Turn = { role: "user" | "model"; text: string };

async function callGemini(history: Turn[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || history.length === 0) return null;
  const contents = history.map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, 2000) }] }));
  try {
    const res = await fetch(`${GEMINI_BASE}/${BOT_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BOT_SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error("[chat-bot] gemini HTTP", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return out || null;
  } catch (e) {
    console.error("[chat-bot] gemini error:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Genera y publica la respuesta del bot a partir del historial reciente del DM.
 * Gemini si hay key (consume crédito en EU); si no o si falla, eco. Pensado para
 * correr en after() → no bloquea el envío del usuario.
 */
export async function respondAsBot(conversationId: string): Promise<void> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { senderId: true, body: true, kind: true },
  });
  const history: Turn[] = rows
    .reverse()
    .map((m) => ({
      role: m.senderId === NIDOKEY_BOT_ID ? ("model" as const) : ("user" as const),
      text: m.body ?? (m.kind === "TEXT" ? "" : "(adjunto)"),
    }))
    .filter((t) => t.text);
  // Gemini exige que el historial empiece por un turno "user".
  while (history.length && history[0].role === "model") history.shift();
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.text ?? null;
  const text = (await callGemini(history)) ?? echoReply(lastUser);
  await replyAsBot(conversationId, text);
}
