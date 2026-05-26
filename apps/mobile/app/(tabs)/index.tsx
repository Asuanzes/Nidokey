import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { PropertyCard, type PropertyCardData } from "@/components/PropertyCard";

export default function PropertiesScreen() {
  const { state } = useAuth();
  const { th } = useTheme();
  const [properties, setProperties] = useState<PropertyCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<PropertyCardData[]>("/api/properties");
      setProperties(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    }
  }, []);

  useEffect(() => {
    if (state.kind === "authed") load();
  }, [state.kind, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (state.kind !== "authed") return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      {!properties && !error && (
        <View style={styles.center}>
          <ActivityIndicator color={th.primary} />
        </View>
      )}
      {error && (
        <View style={styles.center}>
          <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>
        </View>
      )}
      {properties && properties.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: th.text }]}>Aún no tienes casas importadas.</Text>
          <Text style={[styles.emptySub, { color: th.textMuted }]}>
            Desde la web entra a /bookmarklet e instala los userscripts para empezar.
          </Text>
        </View>
      )}
      {properties && properties.length > 0 && (
        <FlatList
          data={properties}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PropertyCard p={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={th.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
  },
  title: { fontSize: 22, fontWeight: "700" },
  count: { fontSize: 12 },
  list: { padding: 16, paddingTop: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 8 },
  error: { fontSize: 13 },
  empty: { fontSize: 15, fontWeight: "500" },
  emptySub: { fontSize: 12, textAlign: "center" },
});
