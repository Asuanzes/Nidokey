import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ChatMessage } from "@prisma/client";

/**
 * Aviso al gateway WS del VPS (F3, tiempo real). Tras persistir un mensaje,
 * Vercel hace un POST firmado (HMAC) con los participantes; el gateway reenvía un
 * evento opaco {type:"message", conversationId} a sus sockets y el móvil hace
 * refetch a Neon. El CONTENIDO del mensaje no viaja por aquí (E2E-ready) y el VPS
 * no guarda nada.
 *
 * Best-effort: si el gateway no está configurado o no responde, no pasa nada —
 * el móvil sigue con polling. Nunca rompe el envío del mensaje.
 *
 * A diferencia del push (push.ts), aquí NO se filtra por mute: el tiempo real
 * debe llegar aunque tengas la conversación silenciada (solo se silencia el
 * banner de notificación, no la actualización de la pantalla abierta).
 */

const url = () => process.env.CHAT_GATEWAY_URL?.trim().replace(/\/+$/, "");
const secret = () => process.env.CHAT_GATEWAY_SECRET || "";

function gatewayEnabled(): boolean {
  return !!url() && !!secret();
}

export async function notifyMessage(message: ChatMessage): Promise<void> {
  if (!gatewayEnabled() || !message.senderId) return;
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: message.conversationId, leftAt: null, userId: { not: message.senderId } },
      select: { userId: true },
    });
    if (participants.length === 0) return;

    const body = JSON.stringify({
      event: "message",
      conversationId: message.conversationId,
      senderId: message.senderId,
      participantIds: participants.map((p) => p.userId),
    });
    const signature = "sha256=" + createHmac("sha256", secret()).update(body).digest("hex");

    await fetch(`${url()}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-nidokey-signature": signature },
      body,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Tiempo real best-effort: nunca rompe el envío del mensaje.
  }
}
