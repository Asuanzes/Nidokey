import type { ChatAttachment, ChatMessage, Conversation, ConversationParticipant, User } from "@prisma/client";

/**
 * DTOs del chat hacia los clientes. Centralizado para que la forma del JSON
 * sea estable entre endpoints (lista, detalle, mensajes).
 */

type ParticipantWithUser = ConversationParticipant & {
  user: Pick<User, "id" | "name" | "email" | "image">;
};

export type ChatUserDto = { id: string; name: string | null; email: string; image: string | null };

export function userDto(u: Pick<User, "id" | "name" | "email" | "image">): ChatUserDto {
  return { id: u.id, name: u.name, email: u.email, image: u.image };
}

/** Nombre a mostrar: name o la parte local del email. */
export function displayName(u: Pick<User, "name" | "email">): string {
  return u.name?.trim() || u.email.split("@")[0];
}

export function participantDto(p: ParticipantWithUser) {
  return {
    userId: p.userId,
    role: p.role,
    lastReadAt: p.lastReadAt?.toISOString() ?? null,
    lastDeliveredAt: p.lastDeliveredAt?.toISOString() ?? null,
    user: userDto(p.user),
  };
}

export function conversationDto(
  c: Conversation & { participants: ParticipantWithUser[] },
  meId: string,
  extras: { unreadCount?: number; context?: { title: string; imageUrl: string | null; subtitle: string | null } | null } = {}
) {
  const me = c.participants.find((p) => p.userId === meId) ?? null;
  const others = c.participants.filter((p) => p.userId !== meId && !p.leftAt);
  // DIRECT: el título es el otro participante.
  const title = c.kind === "DIRECT" ? (others[0] ? displayName(others[0].user) : "—") : c.title ?? "—";
  const imageUrl = c.kind === "DIRECT" ? others[0]?.user.image ?? null : c.imageUrl;
  return {
    id: c.id,
    kind: c.kind,
    title,
    imageUrl,
    contextType: c.contextType,
    contextId: c.contextId,
    context: extras.context ?? null,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: c.lastMessagePreview,
    unreadCount: extras.unreadCount ?? 0,
    muteUntil: me?.muteUntil?.toISOString() ?? null,
    pinnedAt: me?.pinnedAt?.toISOString() ?? null,
    myRole: me?.role ?? "MEMBER",
    participants: c.participants.filter((p) => !p.leftAt).map(participantDto),
    createdAt: c.createdAt.toISOString(),
  };
}

export type ConversationDto = ReturnType<typeof conversationDto>;

export function messageDto(m: ChatMessage & { attachments?: ChatAttachment[] }) {
  const deleted = !!m.deletedAt;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind,
    // Borrado suave: el cuerpo desaparece, el hueco queda ("mensaje eliminado").
    body: deleted ? null : m.body,
    replyToId: m.replyToId,
    clientId: m.clientId,
    editedAt: m.editedAt?.toISOString() ?? null,
    deleted,
    createdAt: m.createdAt.toISOString(),
    attachments: deleted
      ? []
      : (m.attachments ?? []).map((a) => ({
          id: a.id,
          kind: a.kind,
          url: a.url,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          blurhash: a.blurhash,
        })),
  };
}

export type MessageDto = ReturnType<typeof messageDto>;
