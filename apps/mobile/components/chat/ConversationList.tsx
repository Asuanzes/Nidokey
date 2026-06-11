import { memo, useEffect } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useQuery } from "@/lib/hooks/useQuery";
import { listConversations, type ConversationDto } from "@/lib/chat/api";
import { chatSocket } from "@/lib/chat/socket";
import { useSocketOpen } from "@/lib/chat/use-socket-open";
import { categoryColor } from "@/lib/records/config";
import type { RecordType } from "@nidokey/shared";
import { EmptyState } from "@/components/ui";

/**
 * Lista de conversaciones (categoría Chat del rail). Polling suave de 20 s +
 * revalidación on-focus; la pantalla de conversación abierta usa 4 s.
 */
export function ConversationList() {
  const { th, dark } = useTheme();
  const { t } = useTranslation();
  // Polling adaptativo: con socket conectado los eventos refrescan la lista y
  // el polling pasa a fallback lento; con socket caído vuelve a 20 s.
  const socketOpen = useSocketOpen();
  const { data, error, loading, refreshing, refetch } = useQuery(listConversations, [], {
    refreshInterval: socketOpen ? 60_000 : 20_000,
  });

  // Tiempo real (F3): un mensaje nuevo refresca la lista. Coalescing trailing
  // de 500 ms: una ráfaga (grupo activo) = UN refetch, y medio segundo de
  // retraso en la LISTA es imperceptible (la conversación abierta va aparte).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = chatSocket.onMessageEvent(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void refetch();
      }, 500);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [refetch]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title={t("chat.load_error")}
        description={error.message}
        actionLabel={t("common.retry")}
        onAction={refetch}
      />
    );
  }
  if (data && data.length === 0) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title={t("chat.empty_title")}
        description={t("chat.empty_desc")}
        actionLabel={t("chat.new_chat")}
        onAction={() => router.push("/chat/new" as never)}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row c={item} dark={dark} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={th.primary} />}
      />
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push("/chat/contacts" as never)}
          accessibilityRole="button"
          accessibilityLabel={t("chat.contacts_title")}
          style={({ pressed }) => [
            styles.contactsBtn,
            { backgroundColor: th.surface, borderColor: th.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="people-outline" size={20} color={th.primary} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/chat/new" as never)}
          accessibilityRole="button"
          accessibilityLabel={t("chat.new_chat")}
          style={({ pressed }) => [styles.newChatBtn, { backgroundColor: th.primary }, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="create-outline" size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Fila MEMOIZADA por los campos que pinta: cada poll crea instancias nuevas de
 * ConversationDto con datos idénticos; sin memo, todas las filas se repintaban
 * en cada refresco (20-60 s + uno por mensaje entrante).
 */
const Row = memo(RowInner, (prev, next) => {
  const a = prev.c;
  const b = next.c;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.imageUrl === b.imageUrl &&
    a.lastMessageAt === b.lastMessageAt &&
    a.lastMessagePreview === b.lastMessagePreview &&
    a.unreadCount === b.unreadCount &&
    a.pinnedAt === b.pinnedAt &&
    a.muteUntil === b.muteUntil &&
    a.contextType === b.contextType &&
    (a.context?.title ?? null) === (b.context?.title ?? null) &&
    prev.dark === next.dark
  );
});

function RowInner({ c, dark }: { c: ConversationDto; dark: boolean }) {
  const { th } = useTheme();
  const { t, i18n } = useTranslation();
  const accent = c.contextType ? categoryColor(c.contextType as RecordType, dark) : null;

  return (
    <Pressable
      onPress={() => router.push(`/chat/${c.id}` as never)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: th.surface, borderColor: th.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Avatar title={c.title} imageUrl={c.imageUrl} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: th.text }]} numberOfLines={1}>
            {c.title}
          </Text>
          {c.lastMessageAt && (
            <Text style={[styles.rowTime, { color: th.textSubtle }]}>{chatTime(c.lastMessageAt, i18n.language)}</Text>
          )}
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.rowPreview, { color: th.textMuted }]} numberOfLines={1}>
            {c.lastMessagePreview ?? t("chat.no_messages")}
          </Text>
          {c.unreadCount > 0 && (
            <View style={[styles.unread, { backgroundColor: th.accent }]}>
              <Text style={styles.unreadText}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</Text>
            </View>
          )}
        </View>
        {accent && c.context && (
          <View style={[styles.ctxChip, { backgroundColor: accent + "22" }]}>
            <Ionicons name="link-outline" size={11} color={accent} />
            <Text style={[styles.ctxChipText, { color: accent }]} numberOfLines={1}>
              {c.context.title}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function Avatar({ title, imageUrl, size = 46 }: { title: string; imageUrl: string | null; size?: number }) {
  const { th } = useTheme();
  const initials = title
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: th.primarySoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: th.primary, fontFamily: fonts.bodyBold, fontSize: size * 0.36 }}>{initials || "?"}</Text>
    </View>
  );
}

/** Hoy → HH:MM; este año → "12 jun"; si no, fecha corta. */
export function chatTime(iso: string, lang: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const locale = lang === "en" ? "en-GB" : "es-ES";
  if (sameDay) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fabWrap: { position: "absolute", right: 14, bottom: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  contactsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  list: { padding: 12, paddingBottom: 90 },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontFamily: fonts.bodySemibold },
  rowTime: { fontSize: 11 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowPreview: { flex: 1, fontSize: 13 },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#fff", fontSize: 11, fontFamily: fonts.bodyBold },
  ctxChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  ctxChipText: { fontSize: 11, fontFamily: fonts.bodyMedium, maxWidth: 200 },
});
