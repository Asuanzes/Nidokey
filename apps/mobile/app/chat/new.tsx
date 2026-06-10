import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useQuery } from "@/lib/hooks/useQuery";
import {
  contactDisplayName,
  createConversation,
  deleteContact,
  listContacts,
  saveContact,
  searchChatUsers,
  type ChatUser,
  type ContactDto,
} from "@/lib/chat/api";
import { Avatar } from "@/components/chat/ConversationList";
import { ActionsSheet, type SheetOption } from "@/components/chat/ActionsSheet";
import { EmptyState, ResultModal } from "@/components/ui";

/**
 * Nuevo chat: tus contactos guardados arriba (sin buscar) y búsqueda EXACTA por
 * @usuario/email para encontrar a alguien nuevo (debounce 300 ms). Desde un
 * resultado se puede guardar como contacto; long-press en un contacto permite
 * editar su alias o eliminarlo.
 */
export default function NewChatScreen() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ChatUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: contacts, refetch: refetchContacts } = useQuery(listContacts, []);
  const [contactMenu, setContactMenu] = useState<ContactDto | null>(null);
  const [aliasEditing, setAliasEditing] = useState<ContactDto | null>(null);
  const [aliasText, setAliasText] = useState("");
  const [savingAlias, setSavingAlias] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setResults(null);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        setResults(await searchChatUsers(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  async function startChat(userId: string) {
    if (creating) return;
    setCreating(userId);
    try {
      const c = await createConversation({ kind: "DIRECT", participantIds: [userId] });
      router.replace(`/chat/${c.id}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat.create_error"));
      setCreating(null);
    }
  }

  async function onSaveContact(user: ChatUser) {
    try {
      await saveContact(user.id);
      await refetchContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat.action_error"));
    }
  }

  async function onContactMenuSelect(option: SheetOption) {
    const c = contactMenu;
    setContactMenu(null);
    if (!c) return;
    if (option.id === "alias") {
      setAliasText(c.alias ?? "");
      setAliasEditing(c);
      return;
    }
    if (option.id === "remove") {
      try {
        await deleteContact(c.userId);
        await refetchContacts();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("chat.action_error"));
      }
    }
  }

  async function onSaveAlias() {
    const c = aliasEditing;
    if (!c || savingAlias) return;
    setSavingAlias(true);
    try {
      await saveContact(c.userId, aliasText.trim() || null);
      await refetchContacts();
      setAliasEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat.action_error"));
    } finally {
      setSavingAlias(false);
    }
  }

  const contactIds = new Set((contacts ?? []).map((c) => c.userId));
  const showContacts = !results && (contacts?.length ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: th.bg }]}>
      <Stack.Screen options={{ title: t("chat.new_chat") }} />
      <View style={[styles.searchBox, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Ionicons name="search" size={16} color={th.textSubtle} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("chat.search_placeholder")}
          placeholderTextColor={th.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={[styles.searchInput, { color: th.text }]}
        />
        {searching && <ActivityIndicator size="small" color={th.primary} />}
      </View>

      {results && results.length === 0 && !searching && (
        <EmptyState icon="person-outline" title={t("chat.no_users_title")} description={t("chat.no_users_desc")} />
      )}
      {!results && !showContacts && (
        <Text style={[styles.hint, { color: th.textSubtle }]}>{t("chat.search_hint")}</Text>
      )}

      {/* Resultados de búsqueda exacta */}
      {results && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const name = item.name?.trim() || (item.username ? "@" + item.username : null) || item.email.split("@")[0];
            const secondary = item.username ? "@" + item.username : item.email;
            return (
              <Pressable
                onPress={() => void startChat(item.id)}
                disabled={!!creating}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: th.surface, borderColor: th.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Avatar title={name} imageUrl={item.image} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: th.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.rowEmail, { color: th.textMuted }]} numberOfLines={1}>
                    {secondary}
                  </Text>
                </View>
                {!contactIds.has(item.id) && (
                  <Pressable
                    onPress={() => void onSaveContact(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("chat.menu_contact_save")}
                    style={styles.rowAction}
                  >
                    <Ionicons name="person-add-outline" size={18} color={th.textMuted} />
                  </Pressable>
                )}
                {creating === item.id ? (
                  <ActivityIndicator size="small" color={th.primary} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color={th.primary} />
                )}
              </Pressable>
            );
          }}
        />
      )}

      {/* Contactos guardados (cuando no hay búsqueda activa) */}
      {showContacts && (
        <FlatList
          data={contacts ?? []}
          keyExtractor={(c) => c.userId}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: th.textSubtle }]}>{t("chat.contacts_title")}</Text>
          }
          renderItem={({ item }) => {
            const name = contactDisplayName(item);
            const secondary = item.user.username ? "@" + item.user.username : item.user.email;
            return (
              <Pressable
                onPress={() => void startChat(item.userId)}
                onLongPress={() => setContactMenu(item)}
                delayLongPress={350}
                disabled={!!creating}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: th.surface, borderColor: th.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Avatar title={name} imageUrl={item.user.image} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: th.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[styles.rowEmail, { color: th.textMuted }]} numberOfLines={1}>
                    {secondary}
                  </Text>
                </View>
                {creating === item.userId ? (
                  <ActivityIndicator size="small" color={th.primary} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color={th.primary} />
                )}
              </Pressable>
            );
          }}
        />
      )}

      {/* Menú del contacto (long-press): alias / eliminar */}
      <ActionsSheet
        visible={!!contactMenu}
        title={contactMenu ? contactDisplayName(contactMenu) : ""}
        options={[
          { id: "alias", icon: "pencil-outline", label: t("chat.contact_alias_edit") },
          { id: "remove", icon: "person-remove-outline", label: t("chat.menu_contact_remove"), danger: true },
        ]}
        onSelect={(o) => void onContactMenuSelect(o)}
        onClose={() => setContactMenu(null)}
      />

      {/* Editor de alias */}
      <Modal visible={!!aliasEditing} transparent animationType="fade" onRequestClose={() => setAliasEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAliasEditing(null)} />
        <View style={styles.aliasWrap} pointerEvents="box-none">
          <View style={[styles.aliasCard, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.aliasTitle, { color: th.text }]}>{t("chat.contact_alias_title")}</Text>
            <TextInput
              value={aliasText}
              onChangeText={setAliasText}
              placeholder={aliasEditing ? contactDisplayName({ ...aliasEditing, alias: null }) : ""}
              placeholderTextColor={th.textSubtle}
              maxLength={60}
              autoFocus
              style={[styles.aliasInput, { color: th.text, backgroundColor: th.bg, borderColor: th.border }]}
            />
            <Text style={[styles.aliasHint, { color: th.textSubtle }]}>{t("chat.contact_alias_hint")}</Text>
            <View style={styles.aliasActions}>
              <Pressable onPress={() => setAliasEditing(null)} style={styles.aliasBtn}>
                <Text style={{ color: th.textMuted, fontFamily: fonts.bodyMedium }}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable onPress={() => void onSaveAlias()} disabled={savingAlias} style={styles.aliasBtn}>
                {savingAlias ? (
                  <ActivityIndicator size="small" color={th.primary} />
                ) : (
                  <Text style={{ color: th.primary, fontFamily: fonts.bodySemibold }}>{t("common.save")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ResultModal
        visible={!!error}
        tone="error"
        title={t("chat.create_error")}
        message={error ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setError(null) }]}
        onRequestClose={() => setError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  hint: { fontSize: 12, textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  sectionLabel: { fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 8, marginLeft: 2, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowName: { fontSize: 14, fontFamily: fonts.bodySemibold },
  rowEmail: { fontSize: 12 },
  rowAction: { padding: 4 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  aliasWrap: { flex: 1, justifyContent: "center", padding: 24 },
  aliasCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  aliasTitle: { fontSize: 15, fontFamily: fonts.bodySemibold },
  aliasInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  aliasHint: { fontSize: 11 },
  aliasActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  aliasBtn: { paddingHorizontal: 12, paddingVertical: 8 },
});
