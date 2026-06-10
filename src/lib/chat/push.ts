import { prisma } from "@/lib/db";
import { CHAT_FLAGS } from "@/lib/chat/config";
import { displayName } from "@/lib/chat/serialize";
import { messagePreview } from "@/lib/chat/util";
import type { ChatMessage } from "@prisma/client";

/**
 * Notificaciones push del chat vía Expo Push API. Se llama tras persistir un
 * mensaje. Sin gateway de presencia (F1/F2) no sabemos quién está conectado, así
 * que notificamos a TODOS los participantes activos salvo el remitente y los que
 * tengan la conversación silenciada; el cliente suprime el aviso si está mirando
 * esa conversación en primer plano.
 *
 * Privacidad: si CHAT_PUSH_PREVIEW=false, no se envía el texto (solo "Nuevo
 * mensaje") — útil mientras no haya E2E.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: { type: "chat"; conversationId: string };
  channelId: "chat";
};

export async function sendChatPush(message: ChatMessage): Promise<void> {
  if (!message.senderId) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    select: {
      kind: true,
      title: true,
      participants: {
        where: {
          leftAt: null,
          userId: { not: message.senderId },
          OR: [{ muteUntil: null }, { muteUntil: { lt: new Date() } }],
        },
        select: { user: { select: { id: true, name: true, username: true, email: true, image: true } } },
      },
    },
  });
  if (!conversation || conversation.participants.length === 0) return;

  const sender = await prisma.user.findUnique({
    where: { id: message.senderId },
    select: { name: true, username: true, email: true },
  });
  const senderName = sender ? displayName(sender) : "Alguien";

  const recipientIds = conversation.participants.map((p) => p.user.id);
  const devices = await prisma.device.findMany({
    where: { userId: { in: recipientIds } },
    select: { expoPushToken: true },
  });
  if (devices.length === 0) return;

  // Título y cuerpo. En grupo el título es el grupo y el cuerpo "Remitente: …".
  const preview = CHAT_FLAGS.pushPreview ? messagePreview(message.kind, message.body) : "Nuevo mensaje";
  const isGroup = conversation.kind === "GROUP";
  const title = isGroup ? conversation.title ?? "Grupo" : senderName;
  const body = isGroup ? `${senderName}: ${preview}` : preview;

  const payloads: ExpoMessage[] = devices.map((d) => ({
    to: d.expoPushToken,
    title,
    body,
    sound: "default",
    data: { type: "chat", conversationId: message.conversationId },
    channelId: "chat",
  }));

  await deliver(payloads);
}

/** Envía en lotes de 100 y limpia tokens muertos (DeviceNotRegistered). */
async function deliver(messages: ExpoMessage[]): Promise<void> {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
      const tickets = json?.data ?? [];
      tickets.forEach((t, idx) => {
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
          dead.push(chunk[idx].to);
        }
      });
    } catch {
      // Push best-effort: nunca rompe el envío del mensaje.
    }
  }
  if (dead.length) {
    await prisma.device.deleteMany({ where: { expoPushToken: { in: dead } } }).catch(() => {});
  }
}
