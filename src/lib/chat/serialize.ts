import type { ChatAttachment, ChatMessage, Conversation, ConversationParticipant, User } from "@prisma/client";

/**
 * DTOs del chat hacia los clientes. Centralizado para que la forma del JSON
 * sea estable entre endpoints (lista, detalle, mensajes).
 */

type ParticipantWithUser = ConversationParticipant & {
  user: Pick<User, "id" | "name" | "username" | "email" | "image">;
};

export type ChatUserDto = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  image: string | null;
};

/**
 * `User.image` guarda una KEY de R2 (`avatars/<userId>/…`) o, legado, una URL
 * http(s). Hacia el cliente siempre sale una URL: las keys se sirven vía el
 * endpoint público cacheable GET /api/avatar/[userId] (302 a URL firmada);
 * `?v=` = nombre del fichero (cambia al actualizar → rompe caché de expo-image).
 */
export function avatarUrl(u: Pick<User, "id" | "image">): string | null {
  if (!u.image) return null;
  if (/^https?:\/\//i.test(u.image)) return u.image;
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  const v = u.image.split("/").pop() ?? "";
  return `${base}/api/avatar/${u.id}?v=${encodeURIComponent(v)}`;
}

export function userDto(u: Pick<User, "id" | "name" | "username" | "email" | "image">): ChatUserDto {
  return { id: u.id, name: u.name, username: u.username, email: u.email, image: avatarUrl(u) };
}

/** Nombre a mostrar: name, si no @username, si no la parte local del email. */
export function displayName(u: Pick<User, "name" | "username" | "email">): string {
  return u.name?.trim() || (u.username ? "@" + u.username : null) || u.email.split("@")[0];
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
  const imageUrl = c.kind === "DIRECT" ? (others[0] ? avatarUrl(others[0].user) : null) : c.imageUrl;
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

type ReactionRow = { emoji: string; userId: string };

/** Agrega filas de reacción a chips {emoji, count, mine}, ordenados por count. */
export function aggregateReactions(rows: ReactionRow[], meId?: string) {
  const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (meId && r.userId === meId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export function messageDto(
  m: ChatMessage & { attachments?: ChatAttachment[]; reactions?: ReactionRow[] },
  meId?: string
) {
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
    reactions: deleted ? [] : aggregateReactions(m.reactions ?? [], meId),
    attachments: deleted
      ? []
      : (m.attachments ?? []).map((a) => ({
          id: a.id,
          kind: a.kind,
          url: a.url,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          fileName: a.fileName,
          width: a.width,
          height: a.height,
          durationMs: a.durationMs,
          blurhash: a.blurhash,
        })),
  };
}

export type MessageDto = ReturnType<typeof messageDto>;
