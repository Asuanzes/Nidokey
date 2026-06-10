import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@/lib/hooks/useQuery";
import {
  blockUser,
  chatBootstrap,
  deleteContact,
  deleteMessage,
  getConversation,
  listBlocks,
  listContacts,
  listMessages,
  markRead,
  muteConversation,
  saveContact,
  sendMediaMessage,
  sendMessage,
  stableAttachmentUrl,
  toggleReaction,
  unblockUser,
  type AttachmentDto,
  type MessageDto,
} from "@/lib/chat/api";
import {
  audioModuleAvailable,
  formatBytes,
  pickDocument,
  pickImages,
  pickersAvailable,
  takePhoto,
  uploadAttachment,
  type PickedAttachment,
} from "@/lib/chat/media";
import { Avatar, chatTime } from "@/components/chat/ConversationList";
import { ActionsSheet, type SheetOption } from "@/components/chat/ActionsSheet";
import { setActiveConversation } from "@/lib/chat/push";
import { ResultModal } from "@/components/ui";

// Componentes que importan expo-audio (nativo) ESTÁTICAMENTE: se cargan en
// perezoso solo si el binario trae el módulo — una OTA sobre un build viejo
// no crashea (mismo blindaje que lib/chat/push.ts).
/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceRecorder = audioModuleAvailable()
  ? (require("@/components/chat/VoiceRecorder") as typeof import("@/components/chat/VoiceRecorder")).VoiceRecorder
  : null;
const AudioBubble = audioModuleAvailable()
  ? (require("@/components/chat/AudioBubble") as typeof import("@/components/chat/AudioBubble")).AudioBubble
  : null;
/* eslint-enable @typescript-eslint/no-require-imports */

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
  // Flags del servidor (adjuntos/voz dependen de que R2 esté configurado).
  const { data: boot } = useQuery(chatBootstrap, [], { revalidateOnFocus: false });
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
  const [msgActions, setMsgActions] = useState<MessageDto | null>(null);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  // Adjuntos (B1/B2/B4): sheet del "+", subida en curso, grabadora y visor.
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

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
      reactions: [],
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

  async function onReact(message: MessageDto, emoji: string) {
    setMsgActions(null);
    try {
      await toggleReaction(message.id, emoji);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("chat.action_error"));
    }
  }

  // ——— Adjuntos: subir a R2 (presigned PUT) y enviar UN mensaje con todos ———
  const canAttach = !!boot?.flags.attachments && pickersAvailable();
  const canVoice = canAttach && !!boot?.flags.voice && !!VoiceRecorder;

  // Diagnóstico (solo dev): por qué se oculta el "+" — flags del servidor vs
  // módulos nativos ausentes en el binario (build sin recompilar).
  useEffect(() => {
    if (__DEV__) {
      console.log(
        `[chat] attach diag → flags.attachments=${boot?.flags.attachments ?? "boot-null"} ` +
          `pickers=${pickersAvailable()} audio=${audioModuleAvailable()} → boton+=${canAttach}`
      );
    }
  }, [boot, canAttach]);

  async function sendAttachments(kind: "IMAGE" | "FILE" | "AUDIO", files: PickedAttachment[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadAttachment(kind, f));
      const clientId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await sendMediaMessage(id!, { clientId, kind, attachments: uploaded });
      setRecording(false);
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("chat.upload_error"));
    } finally {
      setUploading(false);
    }
  }

  const attachOptions: SheetOption[] = [
    { id: "camera", icon: "camera-outline", label: t("chat.attach_camera") },
    { id: "gallery", icon: "images-outline", label: t("chat.attach_gallery") },
    { id: "file", icon: "document-outline", label: t("chat.attach_file") },
    ...(canVoice ? [{ id: "voice", icon: "mic-outline" as const, label: t("chat.attach_voice") }] : []),
  ];

  // Candado: en iOS un picker que falla al presentarse queda "en curso" y el
  // siguiente intento da "Different document picking in progress".
  const pickingRef = useRef(false);

  async function onAttachSelect(option: SheetOption) {
    setAttachOpen(false);
    if (option.id === "voice") {
      setRecording(true);
      return;
    }
    if (pickingRef.current) return;
    pickingRef.current = true;
    try {
      // iOS no puede presentar el picker mientras nuestro sheet (Modal) aún se
      // está descartando: esperar al dismiss o el picker falla en silencio.
      if (Platform.OS === "ios") await new Promise((r) => setTimeout(r, 500));

      if (option.id === "gallery") {
        await sendAttachments("IMAGE", await pickImages(6));
      } else if (option.id === "camera") {
        const f = await takePhoto();
        if (f) await sendAttachments("IMAGE", [f]);
      } else if (option.id === "file") {
        const f = await pickDocument();
        // Una imagen elegida "como archivo" se envía como FOTO (burbuja con
        // visor), no como fila de descarga.
        if (f) await sendAttachments(f.mime.startsWith("image/") ? "IMAGE" : "FILE", [f]);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("chat.upload_error"));
    } finally {
      pickingRef.current = false;
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
                if (item.kind !== "SYSTEM" && !item.deleted && !item.id.startsWith("tmp_")) setMsgActions(item);
              }}
              onToggleReaction={(emoji) => void onReact(item, emoji)}
              onOpenImage={(url) => setViewerUrl(url)}
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

      {/* Composer (o grabadora de voz en su lugar) */}
      {recording && VoiceRecorder ? (
        <VoiceRecorder
          busy={uploading}
          onCancel={() => setRecording(false)}
          onSend={(f) => void sendAttachments("AUDIO", [f])}
        />
      ) : (
        <View style={[styles.composer, { backgroundColor: th.surface, borderTopColor: th.border }]}>
          {canAttach && (
            <Pressable
              onPress={() => setAttachOpen(true)}
              disabled={uploading}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t("chat.attach_title")}
              style={styles.attachBtn}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={th.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={th.primary} />
              )}
            </Pressable>
          )}
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
      )}

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

      <ActionsSheet
        visible={attachOpen}
        title={t("chat.attach_title")}
        options={attachOptions}
        onSelect={(o) => void onAttachSelect(o)}
        onClose={() => setAttachOpen(false)}
      />

      {/* Visor de imagen a pantalla completa */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={styles.viewerImg} contentFit="contain" />}
        </Pressable>
      </Modal>

      {/* Long-press en un mensaje: reacciones rápidas + eliminar (si es mío) */}
      <MessageActionsSheet
        message={msgActions}
        mine={msgActions?.senderId === myId}
        onReact={(emoji) => msgActions && void onReact(msgActions, emoji)}
        onDelete={() => {
          const m = msgActions;
          setMsgActions(null);
          if (m) setConfirmDelete(m);
        }}
        onClose={() => setMsgActions(null)}
      />
    </SafeAreaView>
  );
}

/** Un adjunto dentro de la burbuja: imagen (tap = visor), audio o fila de archivo. */
function AttachmentView({ a, onOpenImage }: { a: AttachmentDto; onOpenImage: (url: string) => void }) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const url = stableAttachmentUrl(a);

  // Imagen por kind O por MIME: cubre mensajes antiguos enviados como FILE
  // con una foto dentro (se ven como foto, no como fila de descarga).
  if (a.kind === "IMAGE" || a.mimeType.startsWith("image/")) {
    const ratio = a.width && a.height ? Math.min(Math.max(a.width / a.height, 0.6), 1.8) : 4 / 3;
    return (
      <Pressable onPress={() => onOpenImage(url)}>
        <Image
          source={{ uri: url }}
          style={[styles.attachImg, { aspectRatio: ratio, backgroundColor: th.imagePlaceholder }]}
          contentFit="cover"
          transition={120}
        />
      </Pressable>
    );
  }

  if (a.kind === "AUDIO" && AudioBubble) {
    return <AudioBubble url={url} durationMs={a.durationMs} />;
  }

  // FILE — y AUDIO de respaldo si el binario no trae expo-audio.
  return (
    <Pressable
      onPress={() => void Linking.openURL(url).catch(() => {})}
      style={[styles.fileRow, { borderColor: th.border, backgroundColor: th.bg }]}
    >
      <Ionicons
        name={a.kind === "AUDIO" ? "musical-notes-outline" : "document-outline"}
        size={18}
        color={th.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, { color: th.text }]} numberOfLines={1}>
          {a.fileName ?? (a.kind === "AUDIO" ? t("chat.voice_note") : t("chat.file_generic"))}
        </Text>
        <Text style={[styles.fileMeta, { color: th.textSubtle }]}>{formatBytes(a.sizeBytes)}</Text>
      </View>
      <Ionicons name="download-outline" size={16} color={th.textSubtle} />
    </Pressable>
  );
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function MessageActionsSheet({
  message,
  mine,
  onReact,
  onDelete,
  onClose,
}: {
  message: MessageDto | null;
  mine: boolean;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const myEmoji = message?.reactions.find((r) => r.mine)?.emoji ?? null;

  return (
    <Modal visible={!!message} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.msgSheet,
          { backgroundColor: th.surface, borderColor: th.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.msgSheetHandle, { backgroundColor: th.border }]} />
        <View style={styles.reactRow}>
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji)}
              accessibilityRole="button"
              accessibilityLabel={t("chat.react_label")}
              style={({ pressed }) => [
                styles.reactBtn,
                myEmoji === emoji && { backgroundColor: th.primarySoft },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.reactEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        {mine && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.msgSheetRow, pressed && { backgroundColor: th.imagePlaceholder }]}
          >
            <View style={[styles.msgSheetIcon, { backgroundColor: th.dangerSoft }]}>
              <Ionicons name="trash-outline" size={18} color={th.dangerFg} />
            </View>
            <Text style={[styles.msgSheetLabel, { color: th.dangerFg }]}>{t("chat.delete_title")}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

function Bubble({
  m,
  mine,
  dark,
  otherReadAt,
  otherDeliveredAt,
  onLongPress,
  onToggleReaction,
  onOpenImage,
}: {
  m: MessageDto;
  mine: boolean;
  dark: boolean;
  otherReadAt: string | null;
  otherDeliveredAt: string | null;
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
  onOpenImage: (url: string) => void;
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
          <>
            {m.attachments.length > 0 && (
              <View style={styles.attachmentsWrap}>
                {m.attachments.map((a) => (
                  <AttachmentView key={a.id} a={a} onOpenImage={onOpenImage} />
                ))}
              </View>
            )}
            {!!m.body && <Text style={[styles.bubbleText, { color: th.text }]}>{m.body}</Text>}
          </>
        )}
        <View style={styles.bubbleMeta}>
          {m.editedAt && !m.deleted && (
            <Text style={[styles.bubbleTime, { color: th.textSubtle }]}>{t("chat.edited")}</Text>
          )}
          <Text style={[styles.bubbleTime, { color: th.textSubtle }]}>{chatTime(m.createdAt, i18n.language)}</Text>
          {tick && <Ionicons name={tick.icon} size={13} color={tick.color} />}
        </View>
        {m.reactions.length > 0 && (
          <View style={styles.chipRow}>
            {m.reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onToggleReaction(r.emoji)}
                style={[
                  styles.reactionChip,
                  { backgroundColor: th.bg, borderColor: r.mine ? th.primary : th.border },
                ]}
              >
                <Text style={styles.reactionChipText}>
                  {r.emoji}
                  {r.count > 1 ? ` ${r.count}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
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
  // Adjuntos
  attachBtn: { paddingHorizontal: 2, paddingVertical: 6 },
  attachmentsWrap: { gap: 6, marginBottom: 2 },
  attachImg: { width: 220, borderRadius: 10 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 200,
  },
  fileName: { fontSize: 13, fontFamily: fonts.bodyMedium },
  fileMeta: { fontSize: 11 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
  },
  viewerImg: { width: "100%", height: "100%" },
  // Reacciones
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  reactionChipText: { fontSize: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  msgSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  msgSheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  reactRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6, marginBottom: 4 },
  reactBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reactEmoji: { fontSize: 24 },
  msgSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  msgSheetIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  msgSheetLabel: { fontSize: 15, fontFamily: fonts.bodyMedium },
});
