import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@/lib/hooks/useQuery";
import {
  blockUser,
  deleteContact,
  deleteMessage,
  getConversation,
  listBlocks,
  listContacts,
  listMessages,
  markRead,
  muteConversation,
  saveContact,
  sendMessage,
  unblockUser,
  type MessageDto,
} from "@/lib/chat/api";
import { Avatar, chatTime } from "@/components/chat/ConversationList";
import { ActionsSheet, type SheetOption } from "@/components/chat/ActionsSheet";
import { setActiveConversation } from "@/lib/chat/push";
import { ResultModal } from "@/components/ui";

/**
 * Pantalla de conversación. F1 = polling: mensajes cada 4 s (la página más
 * reciente), detalle de la conversación cada 10 s (recibos de lectura). El
 * gateway WS del VPS (F3) sustituirá el polling cuando esté conectado.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th, dark } = useTheme();
  const { t } = useTranslation();
  const { state } = useAuth();
  const myId = state.kind === "authed" ? state.user.id : null;

  const { data: conversation, refetch: refetchConversation } = useQuery(() => getConversation(id!), [id], {
    enabled: !!id,
    refreshInterval: 10_000,
  });
  const {
    data: latest,
    loading,
    refetch,
  } = useQuery(() => listMessages(id!), [id], { enabled: !!id, refreshInterval: 4_000 });

  // Páginas antiguas (cursor hacia atrás) + envíos optimistas.
  const [older, setOlder] = useState<MessageDto[]>([]);
  const [pending, setPending] = useState<MessageDto[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MessageDto | null>(null);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  // Menú de cabecera (contacto / silenciar / bloquear).
  const [menuOpen, setMenuOpen] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [isContact, setIsContact] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mensajes visibles (ASC) dedupe por id y clientId.
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const out: MessageDto[] = [];
    for (const m of [...older, ...(latest?.messages ?? [])]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.clientId) seen.add("c:" + m.clientId);
      out.push(m);
    }
    for (const p of pending) {
      if (p.clientId && seen.has("c:" + p.clientId)) continue;
      out.push(p);
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return out;
  }, [older, latest, pending]);

  // Mientras esta conversación está abierta, no mostrar su propia notificación.
  useEffect(() => {
    setActiveConversation(id ?? null);
    return () => setActiveConversation(null);
  }, [id]);

  // Marcar como leído cuando llegan mensajes nuevos de otros.
  const lastReadIdRef = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId === myId) return;
    if (lastReadIdRef.current === last.id) return;
    lastReadIdRef.current = last.id;
    void markRead(id!).catch(() => {});
  }, [messages, myId, id]);

  const loadOlder = useCallback(async () => {
    const cursor = latest?.nextCursor;
    // Si ya hay páginas antiguas, el cursor es el primer mensaje cargado.
    const effectiveCursor = older.length > 0 ? older[0].id : cursor;
    if (!effectiveCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(id!, effectiveCursor);
      setOlder((prev) => [...page.messages, ...prev]);
    } catch {
      // sin drama: se reintenta al volver a tirar
    } finally {
      setLoadingOlder(false);
    }
  }, [id, latest, older, loadingOlder]);

  async function onSend() {
    const body = text.trim();
    if (!body || !myId) return;
    const clientId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: MessageDto = {
      id: "tmp_" + clientId,
      conversationId: id!,
      senderId: myId,
      kind: "TEXT",
      body,
      replyToId: null,
      clientId,
      editedAt: null,
      deleted: false,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    setText("");
    setPending((p) => [...p, optimistic]);
    try {
      await sendMessage(id!, { clientId, body });
      setPending((p) => p.filter((m) => m.clientId !== clientId));
      await refetch();
    } catch (e) {
      setPending((p) => p.filter((m) => m.clientId !== clientId));
      setText(body); // devolver el texto al composer para reintentar
      setSendError(e instanceof Error ? e.message : t("chat.send_error"));
    }
  }

  async function onDelete() {
    const m = confirmDelete;
    setConfirmDelete(null);
    if (!m) return;
    try {
      await deleteMessage(m.id);
      await refetch();
    } catch {
      // el mensaje sigue; el usuario puede reintentar
    }
  }

  // Recibo del otro lado (solo DIRECT): hasta cuándo ha leído/recibido.
  const other = conversation?.participants.find((p) => p.userId !== myId);
  const otherReadAt = conversation?.kind === "DIRECT" ? other?.lastReadAt ?? null : null;
  const otherDeliveredAt = conversation?.kind === "DIRECT" ? other?.lastDeliveredAt ?? null : null;

  const inverted = useMemo(() => [...messages].reverse(), [messages]);

  const muted = !!conversation?.muteUntil && new Date(conversation.muteUntil) > new Date();
  const isDirect = conversation?.kind === "DIRECT";
  const otherUserId = isDirect ? other?.userId ?? null : null;

  // Abre el menú y resuelve el estado contacto/bloqueado bajo demanda (listas
  // pequeñas; evita cargarlas en cada entrada al chat).
  async function openMenu() {
    setMenuOpen(true);
    if (!otherUserId) return;
    setMenuBusy(true);
    try {
      const [contacts, blocks] = await Promise.all([listContacts(), listBlocks()]);
      setIsContact(contacts.some((c) => c.userId === otherUserId));
      setIsBlocked(blocks.some((b) => b.userId === otherUserId));
    } catch {
      // Sin red: el menú muestra las acciones con el último estado conocido.
    } finally {
      setMenuBusy(false);
    }
  }

  const menuOptions: SheetOption[] = [];
  if (otherUserId) {
    menuOptions.push(
      isContact
        ? { id: "contact_remove", icon: "person-remove-outline", label: t("chat.menu_contact_remove") }
        : { id: "contact_save", icon: "person-add-outline", label: t("chat.menu_contact_save") }
    );
  }
  menuOptions.push({
    id: "mute",
    icon: muted ? "notifications-outline" : "notifications-off-outline",
    label: muted ? t("chat.menu_muted") : t("chat.menu_mute"),
    hint: muted ? t("chat.menu_muted_hint") : undefined,
  });
  if (otherUserId) {
    menuOptions.push(
      isBlocked
        ? { id: "unblock", icon: "lock-open-outline", label: t("chat.menu_unblock") }
        : { id: "block", icon: "ban-outline", label: t("chat.menu_block"), danger: true }
    );
  }

  async function onMenuSelect(option: SheetOption) {
    if (option.id === "mute") {
      setMenuOpen(false);
      setMuteOpen(true);
      return;
    }
    setMenuOpen(false);
    if (!otherUserId) return;
    try {
      if (option.id === "contact_save") {
        await saveContact(otherUserId);
        setIsContact(true);
      } else if (option.id === "contact_remove") {
        await deleteContact(otherUserId);
        setIsContact(false);
      } else if (option.id === "block") {
        await blockUser(otherUserId);
        setIsBlocked(true);
      } else if (option.id === "unblock") {
        await unblockUser(otherUserId);
        setIsBlocked(false);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("chat.action_error"));
    }
  }

  const muteOptions: SheetOption[] = [
    { id: "8h", icon: "time-outline", label: t("chat.mute_8h") },
    { id: "1w", icon: "calendar-outline", label: t("chat.mute_1w") },
    { id: "forever", icon: "infinite-outline", label: t("chat.mute_forever") },
    ...(muted
      ? [{ id: "none", icon: "notifications-outline" as const, label: t("chat.mute_off") }]
      : []),
  ];

  async function onMuteSelect(option: SheetOption) {
    setMuteOpen(false);
    const until =
      option.id === "8h"
        ? new Date(Date.now() + 8 * 3600_000).toISOString()
        : option.id === "1w"
          ? new Date(Date.now() + 7 * 24 * 3600_000).toISOString()
          : option.id === "forever"
            ? new Date("9999-01-01T00:00:00.000Z").toISOString()
            : null;
    try {
      await muteConversation(id!, until);
      await refetchConversation();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("chat.action_error"));
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Un único KAV a pantalla completa: con edge-to-edge Android ignora
          adjustResize, así que el "padding" del KAV es lo que sube el composer
          (y encoge la FlatList invertida → el último mensaje sigue visible). */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">

      {/* Header propio: volver + avatar + título */}
      <View style={[styles.header, { backgroundColor: th.surface, borderBottomColor: th.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={th.primary} />
        </Pressable>
        <Avatar title={conversation?.title ?? "…"} imageUrl={conversation?.imageUrl ?? null} size={34} />
        <View style={styles.headerText}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerTitle, { color: th.text }]} numberOfLines={1}>
              {conversation?.title ?? t("common.loading")}
            </Text>
            {muted && <Ionicons name="notifications-off-outline" size={14} color={th.textSubtle} />}
          </View>
          {conversation?.kind === "GROUP" && (
            <Text style={[styles.headerSub, { color: th.textMuted }]} numberOfLines={1}>
              {t("chat.members", { count: conversation.participants.length })}
            </Text>
          )}
        </View>
        {conversation && (
          <Pressable
            onPress={() => void openMenu()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("chat.menu_title")}
            style={styles.headerMenu}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={th.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Banner del registro vinculado */}
      {conversation?.context && (
        <Pressable
          onPress={() => {
            if (conversation.contextType && conversation.contextId) {
              router.push(`/${conversation.contextType}/${conversation.contextId}` as never);
            }
          }}
          style={[styles.ctxBanner, { backgroundColor: th.surface, borderColor: th.border }]}
        >
          {conversation.context.imageUrl ? (
            <Image source={{ uri: conversation.context.imageUrl }} style={styles.ctxImg} contentFit="cover" />
          ) : (
            <View style={[styles.ctxImg, { backgroundColor: th.imagePlaceholder }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.ctxTitle, { color: th.text }]} numberOfLines={1}>
              {conversation.context.title}
            </Text>
            {conversation.context.subtitle && (
              <Text style={[styles.ctxSub, { color: th.textMuted }]} numberOfLines={1}>
                {conversation.context.subtitle}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={th.textSubtle} />
        </Pressable>
      )}
      {conversation && conversation.contextType && !conversation.context && (
        <View style={[styles.ctxBanner, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.ctxSub, { color: th.textSubtle }]}>{t("chat.context_deleted")}</Text>
        </View>
      )}

      {loading && !latest ? (
        <View style={styles.center}>
          <ActivityIndicator color={th.primary} />
        </View>
      ) : (
        <FlatList
          data={inverted}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <Bubble
              m={item}
              mine={item.senderId === myId}
              dark={dark}
              otherReadAt={otherReadAt}
              otherDeliveredAt={otherDeliveredAt}
              onLongPress={() => {
                if (item.senderId === myId && !item.deleted && !item.id.startsWith("tmp_")) setConfirmDelete(item);
              }}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={th.primary} style={{ marginVertical: 8 }} /> : null}
        />
      )}

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: th.surface, borderTopColor: th.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("chat.composer_placeholder")}
          placeholderTextColor={th.textSubtle}
          multiline
          maxLength={4000}
          style={[styles.input, { color: th.text, backgroundColor: th.bg, borderColor: th.border }]}
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          style={[styles.sendBtn, { backgroundColor: text.trim() ? th.primary : th.border }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      </KeyboardAvoidingView>

      <ResultModal
        visible={!!confirmDelete}
        tone="error"
        icon="trash-outline"
        title={t("chat.delete_title")}
        message={t("chat.delete_message")}
        actions={[
          { label: t("common.delete"), variant: "danger", onPress: () => void onDelete() },
          { label: t("common.cancel"), variant: "ghost", onPress: () => setConfirmDelete(null) },
        ]}
        onRequestClose={() => setConfirmDelete(null)}
      />
      <ResultModal
        visible={!!sendError}
        tone="error"
        title={t("chat.send_error")}
        message={sendError ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setSendError(null) }]}
        onRequestClose={() => setSendError(null)}
      />
      <ResultModal
        visible={!!actionError}
        tone="error"
        title={t("chat.action_error")}
        message={actionError ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setActionError(null) }]}
        onRequestClose={() => setActionError(null)}
      />

      <ActionsSheet
        visible={menuOpen}
        title={conversation?.title ?? ""}
        options={menuOptions}
        busy={menuBusy}
        onSelect={(o) => void onMenuSelect(o)}
        onClose={() => setMenuOpen(false)}
      />
      <ActionsSheet
        visible={muteOpen}
        title={t("chat.mute_title")}
        options={muteOptions}
        onSelect={(o) => void onMuteSelect(o)}
        onClose={() => setMuteOpen(false)}
      />
    </SafeAreaView>
  );
}

function Bubble({
  m,
  mine,
  dark,
  otherReadAt,
  otherDeliveredAt,
  onLongPress,
}: {
  m: MessageDto;
  mine: boolean;
  dark: boolean;
  otherReadAt: string | null;
  otherDeliveredAt: string | null;
  onLongPress: () => void;
}) {
  const { th } = useTheme();
  const { t, i18n } = useTranslation();

  if (m.kind === "SYSTEM") {
    return (
      <View style={styles.sysWrap}>
        <Text style={[styles.sysText, { color: th.textSubtle, backgroundColor: th.surface }]}>{m.body}</Text>
      </View>
    );
  }

  // Ticks de estado (solo mis mensajes, solo DIRECT): ✓ enviado, ✓✓ entregado,
  // ✓✓ azul leído. Derivado de lastReadAt/lastDeliveredAt del otro (sin filas).
  let tick: { icon: "checkmark" | "checkmark-done"; color: string } | null = null;
  if (mine && !m.id.startsWith("tmp_")) {
    const read = otherReadAt && m.createdAt <= otherReadAt;
    const delivered = otherDeliveredAt && m.createdAt <= otherDeliveredAt;
    tick = read
      ? { icon: "checkmark-done", color: "#3B82F6" }
      : delivered
        ? { icon: "checkmark-done", color: th.textSubtle }
        : { icon: "checkmark", color: th.textSubtle };
  }

  const mineBg = dark ? "#3D3554" : "#E9E2F5"; // morado suave (color de la categoría chat)
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: mine ? mineBg : th.surface, borderColor: th.border },
          m.id.startsWith("tmp_") && { opacity: 0.6 },
        ]}
      >
        {m.deleted ? (
          <Text style={[styles.deletedText, { color: th.textSubtle }]}>{t("chat.message_deleted")}</Text>
        ) : (
          <Text style={[styles.bubbleText, { color: th.text }]}>{m.body}</Text>
        )}
        <View style={styles.bubbleMeta}>
          {m.editedAt && !m.deleted && (
            <Text style={[styles.bubbleTime, { color: th.textSubtle }]}>{t("chat.edited")}</Text>
          )}
          <Text style={[styles.bubbleTime, { color: th.textSubtle }]}>{chatTime(m.createdAt, i18n.language)}</Text>
          {tick && <Ionicons name={tick.icon} size={13} color={tick.color} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { padding: 4 },
  headerText: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerMenu: { padding: 4 },
  headerTitle: { fontSize: 16, fontFamily: fonts.bodySemibold, flexShrink: 1 },
  headerSub: { fontSize: 11 },
  ctxBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 10,
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  ctxImg: { width: 38, height: 38, borderRadius: 6 },
  ctxTitle: { fontSize: 13, fontFamily: fonts.bodyMedium },
  ctxSub: { fontSize: 12 },
  list: { padding: 12, gap: 6 },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 20 },
  deletedText: { fontSize: 13, fontStyle: "italic" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  bubbleTime: { fontSize: 10 },
  sysWrap: { alignItems: "center", marginVertical: 4 },
  sysText: { fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
