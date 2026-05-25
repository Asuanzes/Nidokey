import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { formatPrice } from "@buysell/shared";

type Match = {
  id: string;
  score: number;
  reasons: string[];
  source: PropMin;
  target: PropMin;
};
type PropMin = {
  id: string;
  title: string;
  city: string;
  currentPrice: number | null;
  media: { url: string }[];
  listings: { portal: string }[];
};

export default function MatchesScreen() {
  const [items, setItems] = useState<Match[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<{ items: Match[] }>("/api/matches");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Duplicados</Text>
        <Text style={styles.count}>
          {items ? `${items.length} pendiente${items.length !== 1 ? "s" : ""}` : "…"}
        </Text>
      </View>

      {!items && !error && (
        <View style={styles.center}><ActivityIndicator color="#3A5F8A" /></View>
      )}
      {error && <View style={styles.center}><Text style={styles.error}>{error}</Text></View>}
      {items && items.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.empty}>Sin duplicados pendientes</Text>
          <Text style={styles.emptySub}>
            Cuando importes inmuebles parecidos a otros, aparecerán aquí.
          </Text>
        </View>
      )}

      {items && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchRow m={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3A5F8A" />}
        />
      )}
    </SafeAreaView>
  );
}

function MatchRow({ m }: { m: Match }) {
  const scoreColor =
    m.score >= 90 ? "#15803D" : m.score >= 70 ? "#A86A17" : "#666";
  return (
    <View style={styles.card}>
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "22" }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{m.score}%</Text>
        </View>
        <Text style={styles.reasons} numberOfLines={2}>{m.reasons.join(" · ")}</Text>
      </View>
      <View style={styles.row}>
        <PropTile p={m.source} />
        <Text style={styles.arrow}>↔</Text>
        <PropTile p={m.target} />
      </View>
    </View>
  );
}

function PropTile({ p }: { p: PropMin }) {
  return (
    <Link href={`/property/${p.id}` as never} asChild>
      <View style={styles.tile}>
        {p.media[0] ? (
          <Image source={{ uri: p.media[0].url }} style={styles.tileImage} contentFit="cover" />
        ) : (
          <View style={[styles.tileImage, { backgroundColor: "#f3f3f3" }]} />
        )}
        <Text style={styles.tileTitle} numberOfLines={2}>{p.title}</Text>
        <Text style={styles.tileMeta}>
          {p.city} · {formatPrice(p.currentPrice)}
        </Text>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF7" },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  count: { fontSize: 12, color: "#666" },
  list: { padding: 16, paddingTop: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 8 },
  empty: { color: "#1a1a1a", fontSize: 15, fontWeight: "500" },
  emptySub: { color: "#666", fontSize: 12, textAlign: "center" },
  error: { color: "#B91C1C", fontSize: 13 },
  card: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e5e5e5", marginBottom: 10, gap: 12,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  scoreText: { fontSize: 12, fontWeight: "700" },
  reasons: { flex: 1, fontSize: 11, color: "#666" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tile: { flex: 1, gap: 4 },
  tileImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: 6 },
  tileTitle: { fontSize: 12, fontWeight: "500", color: "#1a1a1a" },
  tileMeta: { fontSize: 11, color: "#666" },
  arrow: { fontSize: 18, color: "#999", paddingHorizontal: 4 },
});
