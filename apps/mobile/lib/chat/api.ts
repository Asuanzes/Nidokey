import { api } from "@/lib/api";

/**
 * Cliente del chat: tipos DTO (espejo de src/lib/chat/serialize.ts) y fetchers.
 * Todo pasa por el helper api() (JWT automático).
 */

export type ChatUser = { id: string; name: string | null; username: string | null; email: string; image: string | null };

export type ChatParticipant = {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  lastReadAt: string | null;
  lastDeliveredAt: string | null;
  user: ChatUser;
};

export type ConversationDto = {
  id: string;
  kind: "DIRECT" | "GROUP";
  title: string;
  imageUrl: string | null;
  contextType: string | null;
  contextId: string | null;
  context: { title: string; imageUrl: string | null; subtitle: string | null } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  muteUntil: string | null;
  pinnedAt: string | null;
  myRole: "OWNER" | "ADMIN" | "MEMBER";
  participants: ChatParticipant[];
  createdAt: string;
};

export type MessageDto = {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: "TEXT" | "IMAGE" | "FILE" | "AUDIO" | "SYSTEM";
  body: string | null;
  replyToId: string | null;
  clientId: string | null;
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
  attachments: { id: string; kind: string; url: string; mimeType: string }[];
};

export type ChatBootstrap = {
  flags: {
    enabled: boolean;
    groups: boolean;
    attachments: boolean;
    voice: boolean;
    typing: boolean;
    contextLinks: boolean;
  };
  limits: { maxMessageChars: number; maxGroupParticipants: number; editWindowMin: number };
  unreadTotal: number;
};

export const chatBootstrap = () => api<ChatBootstrap>("/api/chat/bootstrap");

export const listConversations = () =>
  api<{ conversations: ConversationDto[] }>("/api/chat/conversations").then((d) => d.conversations);

export const getConversation = (id: string) => api<ConversationDto>(`/api/chat/conversations/${id}`);

export const createConversation = (input: {
  kind?: "DIRECT" | "GROUP";
  participantIds: string[];
  title?: string;
  contextType?: string | null;
  contextId?: string | null;
}) =>
  api<ConversationDto>("/api/chat/conversations", { method: "POST", body: JSON.stringify(input) });

export const listMessages = (conversationId: string, cursor?: string | null) =>
  api<{ messages: MessageDto[]; nextCursor: string | null }>(
    `/api/chat/conversations/${conversationId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
  );

export const sendMessage = (conversationId: string, input: { clientId: string; body: string; replyToId?: string | null }) =>
  api<MessageDto>(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ ...input, kind: "TEXT" }),
  });

export const markRead = (conversationId: string) =>
  api<{ ok: true; lastReadAt: string }>(`/api/chat/conversations/${conversationId}/read`, { method: "POST" });

export const deleteMessage = (messageId: string) =>
  api<MessageDto>(`/api/chat/messages/${messageId}`, { method: "DELETE" });

export const searchChatUsers = (q: string) =>
  api<{ users: ChatUser[] }>(`/api/chat/users/search?q=${encodeURIComponent(q)}`).then((d) => d.users);

export const blockUser = (userId: string) =>
  api("/api/chat/blocks", { method: "POST", body: JSON.stringify({ userId }) });

export const leaveConversation = (conversationId: string) =>
  api(`/api/chat/conversations/${conversationId}`, { method: "PATCH", body: JSON.stringify({ leave: true }) });
