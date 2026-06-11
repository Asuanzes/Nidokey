import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/hooks/useQuery";
import { createConversation, listContacts } from "@/lib/chat/api";
import { ContactsList } from "@/components/chat/ContactsList";
import { EmptyState, ResultModal } from "@/components/ui";

/**
 * Agenda de contactos guardados: tap = abrir (o crear) el chat 1:1;
 * long-press = alias / eliminar (dentro de ContactsList). El estado
 * en línea / última conexión llegará con el gateway de presencia (F3).
 */
export default function ContactsScreen() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const { data: contacts, loading, refetch } = useQuery(listContacts, []);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={[styles.container, { backgroundColor: th.bg }]}>
      <Stack.Screen options={{ title: t("chat.contacts_title") }} />

      {loading && !contacts ? (
        <View style={styles.center}>
          <ActivityIndicator color={th.primary} />
        </View>
      ) : (contacts?.length ?? 0) === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t("chat.contacts_empty_title")}
          description={t("chat.contacts_empty_desc")}
          actionLabel={t("chat.new_chat")}
          onAction={() => router.push("/chat/new" as never)}
        />
      ) : (
        <ContactsList
          contacts={contacts ?? []}
          creating={creating}
          onStartChat={(userId) => void startChat(userId)}
          onChanged={refetch}
          onError={setError}
        />
      )}

      <ResultModal
        visible={!!error}
        tone="error"
        title={t("chat.action_error")}
        message={error ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setError(null) }]}
        onRequestClose={() => setError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
