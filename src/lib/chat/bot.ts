import { prisma } from "@/lib/db";
import { directKey, messagePreview } from "@/lib/chat/util";
import { sendChatPush } from "@/lib/chat/push";
import { notifyMessage } from "@/lib/chat/gateway";
import { BOT_TOOLS, runTool, mintUserToken } from "@/lib/chat/bot-tools";

const MAX_REPLY_CHARS = 800;
const MAX_TOOL_ITERS = 4; // ponytail: tope de vueltas tool→modelo (anti-bucle/coste)

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
  await ensureNidokeyBot(); // solo al crear el DM (no un upsert en cada poll de la lista)
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

// ── Fase 4: respuesta con LLM. Usamos Groq (gratis, funciona en EU, sin billing),
// el mismo proveedor principal de la extracción de menús. Nota: los €258 de GCP
// NO pagan el Gemini API de AI Studio (lleva prepago aparte); para gastar ese
// crédito habría que ir por Vertex AI. API de Groq compatible con OpenAI.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
const HISTORY_TURNS = 15; // ponytail: ventana fija; subir si hace falta más contexto

const BOT_SYSTEM_PROMPT = [
  "Eres «Nidokey», el asistente integrado en la app Nidokey: un organizador personal con varias categorías (inmuebles, comida, viajes, criptos, mercados, empleos, libros, tendencias y chat).",
  "Hablas en español, cercano y BREVE (2-4 frases). Puedes usar el emoji 🪺 de vez en cuando.",
  "Tienes HERRAMIENTAS para CONSULTAR los datos reales del usuario y los feeds; úsalas en vez de inventar:",
  "- listar_registros(type) y ver_registro(type,id): sus inmuebles/criptos/mercados/empleos/libros/viajes (para 'buscar', lista y filtra tú).",
  "- tendencias(source?), noticias_tendencia(trend_id), noticias_activos(crypto|market): tendencias y noticias.",
  "- buscar_restaurantes(query?,ciudad?), buscar_platos(query,ciudad?), carta_restaurante(restaurant_id): comida a domicilio. Usa la dirección guardada; si no hay, pide la ciudad. Si menuStatus es PENDING o no hay platos, la carta se está preparando: dilo.",
  "Usa las herramientas por su MECANISMO de tool-calling; NUNCA escribas en el mensaje el nombre de una herramienta, sus argumentos ni JSON crudo: el usuario solo ve tu respuesta en lenguaje natural.",
  "Para 'mis criptos' usa listar_registros('crypto'); para 'mis acciones/mercados/ETFs' listar_registros('market'); noticias_activos es SOLO para noticias de esos activos.",
  "ENLACES: al mencionar un REGISTRO del usuario (de listar_registros/ver_registro), ponlo como enlace pulsable con el formato [[tipo:id|Título]] (p.ej. [[property:abc123|Piso en Oviedo]]). Solo para esos registros (no restaurantes ni noticias).",
  "LÍMITES: solo LECTURA. NO creas, editas, borras, fusionas ni pagas nada; si lo pide, explícale cómo hacerlo él.",
  "No inventes datos: si una herramienta no devuelve nada, dilo con naturalidad.",
].join("\n");

type Turn = { role: "user" | "model"; text: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Una "conversación" con el modelo: pregunta → si pide herramientas, las ejecuta
 *  y vuelve a preguntar con los resultados, hasta MAX_TOOL_ITERS o respuesta final. */
async function runConversation(baseMessages: any[], model: string, key: string, token: string): Promise<string | null> {
  const messages: any[] = [...baseMessages];
  for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, tools: BOT_TOOLS, temperature: 0.5, max_tokens: 600 }),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
    const msg = ((await res.json()) as any).choices?.[0]?.message;
    if (!msg) return null;
    const calls = msg.tool_calls as { id: string; function?: { name?: string; arguments?: string } }[] | undefined;
    if (calls?.length) {
      messages.push(msg); // turno assistant con tool_calls (hay que devolverlo tal cual)
      for (const tc of calls) {
        const result = await runTool(tc.function?.name, tc.function?.arguments, token);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue; // re-preguntar al modelo con los resultados de las herramientas
    }
    const out = (msg.content as string | undefined)?.trim();
    if (out) {
      console.log("[chat-bot] groq OK", out.length, "chars, model=", model);
      return out;
    }
    return null;
  }
  console.warn("[chat-bot] máx. iteraciones de herramientas, model=", model);
  return null;
}

async function callGroq(history: Turn[], token: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    console.warn("[chat-bot] sin GROQ_API_KEY en el entorno del deploy (¿env en Production + redeploy?)");
    return null;
  }
  if (history.length === 0) {
    console.warn("[chat-bot] historial vacío, no llamo al LLM");
    return null;
  }
  const base: any[] = [
    { role: "system", content: BOT_SYSTEM_PROMPT },
    ...history.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text.slice(0, 2000) })),
  ];
  // Resiliencia: modelo principal y, si falla/429, uno más ligero (mayor cuota/min).
  const models = [...new Set([GROQ_MODEL, "llama-3.1-8b-instant"])];
  for (const model of models) {
    try {
      const out = await runConversation(base, model, key, token);
      if (out) return out;
    } catch (e) {
      console.error("[chat-bot] groq error", model, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Genera y publica la respuesta del bot a partir del historial reciente del DM.
 * Con herramientas (Groq function calling) acuñando un JWT del usuario para
 * consultar SUS datos vía los endpoints existentes. Si no hay key o falla → eco.
 * Pensado para correr en after() → no bloquea el envío del usuario.
 */
export async function respondAsBot(conversationId: string, userId: string): Promise<void> {
  const [rows, user] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: HISTORY_TURNS,
      select: { senderId: true, body: true, kind: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const history: Turn[] = rows
    .reverse()
    .map((m) => ({
      role: m.senderId === NIDOKEY_BOT_ID ? ("model" as const) : ("user" as const),
      text: m.body ?? (m.kind === "TEXT" ? "" : "(adjunto)"),
    }))
    .filter((t) => t.text);
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.text ?? null;
  const token = await mintUserToken(userId, user?.email ?? "");
  const text = (await callGroq(history, token)) ?? echoReply(lastUser);
  await replyAsBot(conversationId, text);
}
