import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/hooks/useQuery";
import { searchRecords } from "@/lib/data/records-repository";
import { RecordCard } from "@/components/RecordCard";
import { EmptyState, Screen } from "@/components/ui";

export default function SearchScreen() {
  const { th } = useTheme();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce de 250ms sobre el texto.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(handle);
  }, [q]);

  const ready = debounced.trim().length >= 2;
  const { data: results, loading } = useQuery(
    () => searchRecords(debounced),
    [debounced],
    { enabled: ready, revalidateOnFocus: false }
  );

  return (
    <Screen>
      <View style={[styles.searchBar, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Ionicons name="search" size={16} color={th.textSubtle} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar en tus registros…"
          placeholderTextColor={th.textSubtle}
          style={[styles.input, { color: th.text }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && ready && <ActivityIndicator size="small" color={th.primary} />}
      </View>

      {ready && results && results.length === 0 && !loading && (
        <EmptyState icon="search-outline" title={`Sin resultados para "${debounced}"`} />
      )}

      <FlatList
        data={results ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecordCard record={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: 16 },
});
