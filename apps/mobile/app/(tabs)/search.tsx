import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { PropertyCard, type PropertyCardData } from "@/components/PropertyCard";

type SearchResult = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  currentPrice: number | null;
  type: string;
  media: { url: string }[];
};

export default function SearchScreen() {
  const { th } = useTheme();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(q)}`
        );
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: th.text }]}>Buscar</Text>
      </View>
      <View style={[styles.searchBar, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Ionicons name="search" size={16} color={th.textSubtle} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Título, ciudad, barrio, ref. catastral…"
          placeholderTextColor={th.textSubtle}
          style={[styles.input, { color: th.text }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color={th.primary} />}
      </View>

      {q.trim().length >= 2 && results.length === 0 && !loading && (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: th.textMuted }]}>
            Sin resultados para &quot;{q}&quot;
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <PropertyCard
            p={{
              ...item,
              status: "FOR_SALE",
              rooms: null,
              bathrooms: null,
              builtArea: null,
            } as PropertyCardData}
          />
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 12, height: 44,
    borderRadius: 8, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: 16 },
  center: { padding: 24, alignItems: "center" },
  empty: { fontSize: 13 },
});
