import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import type { BaseRecord } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Screen } from "@/components/ui";

/**
 * "Compartidos conmigo": registros que otros usuarios me han compartido
 * (solo lectura). Lee GET /api/records/shared (BaseRecord[] con meta.sharedBy).
 * Al tocar uno abre su ficha normal (/tipo/id), que el backend sirve en lectura.
 */
export default function SharedScreen() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<BaseRecord[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api<BaseRecord[]>("/api/records/shared"));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (items === null) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={th.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(r) => `${r.type}:${r.id}`}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={th.primary} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: th.textSubtle }]}>{t("shared.empty")}</Text>}
        renderItem={({ item }) => {
          const by = (item.meta as Record<string, unknown> | null)?.sharedBy;
          return (
            <Pressable
              onPress={() => router.push(`/${item.type}/${item.id}` as never)}
              style={[styles.row, { backgroundColor: th.surface, borderColor: th.border }]}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: th.imagePlaceholder }]} />
              )}
              <View style={styles.body}>
                <Text numberOfLines={1} style={[styles.title, { color: th.text }]}>{item.title}</Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={[styles.sub, { color: th.textMuted }]}>{item.subtitle}</Text>
                ) : null}
                {by ? (
                  <Text numberOfLines={1} style={[styles.by, { color: th.textSubtle }]}>
                    {t("shared.by", { user: "@" + String(by) })}
                  </Text>
                ) : null}
              </View>
              {item.primaryValue ? <Text style={[styles.value, { color: th.text }]}>{item.primaryValue}</Text> : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { textAlign: "center", marginTop: 48, fontSize: 14, paddingHorizontal: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 13, marginTop: 1 },
  by: { fontSize: 11, marginTop: 2 },
  value: { fontSize: 14, fontWeight: "600" },
});
