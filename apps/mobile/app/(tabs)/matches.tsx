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

import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useQuery } from "@/lib/hooks/useQuery";
import { formatPrice } from "@nidokey/shared";
import { EmptyState, Screen } from "@/components/ui";

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

const fetchMatches = () =>
  api<{ items: Match[] }>("/api/matches").then((d) => d.items);

export default function MatchesScreen() {
  const { th } = useTheme();
  const { data: items, error, loading, refreshing, refetch } = useQuery(fetchMatches, []);

  const count = items?.length ?? 0;

  return (
    <Screen
      title="Duplicados"
      subtitle={items ? `${count} pendiente${count !== 1 ? "s" : ""}` : "…"}
    >
      {loading && !items && (
        <View style={styles.center}>
          <ActivityIndicator color={th.primary} />
        </View>
      )}
      {error && (
        <EmptyState
          icon="cloud-offline-outline"
          title="No se pudieron cargar los duplicados"
          description={error.message}
          actionLabel="Reintentar"
          onAction={refetch}
        />
      )}
      {items && items.length === 0 && !error && (
        <EmptyState
          icon="sparkles-outline"
          title="Sin duplicados pendientes"
          description="Cuando importes inmuebles parecidos a otros, aparecerán aquí."
        />
      )}
      {items && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchRow m={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={th.primary} />
          }
        />
      )}
    </Screen>
  );
}

function MatchRow({ m }: { m: Match }) {
  const { th } = useTheme();
  const scoreColor =
    m.score >= 90 ? "#15803D" : m.score >= 70 ? "#A86A17" : th.textMuted;
  return (
    <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + "22" }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{m.score}%</Text>
        </View>
        <Text style={[styles.reasons, { color: th.textMuted }]} numberOfLines={2}>
          {m.reasons.join(" · ")}
        </Text>
      </View>
      <View style={styles.row}>
        <PropTile p={m.source} />
        <Text style={[styles.arrow, { color: th.textSubtle }]}>↔</Text>
        <PropTile p={m.target} />
      </View>
    </View>
  );
}

function PropTile({ p }: { p: PropMin }) {
  const { th } = useTheme();
  return (
    <Link href={`/property/${p.id}` as never} asChild>
      <View style={styles.tile}>
        {p.media[0] ? (
          <Image source={{ uri: p.media[0].url }} style={styles.tileImage} contentFit="cover" />
        ) : (
          <View style={[styles.tileImage, { backgroundColor: th.imagePlaceholder }]} />
        )}
        <Text style={[styles.tileTitle, { color: th.text }]} numberOfLines={2}>{p.title}</Text>
        <Text style={[styles.tileMeta, { color: th.textMuted }]}>
          {p.city} · {formatPrice(p.currentPrice)}
        </Text>
      </View>
    </Link>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingTop: 0 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    borderRadius: 10, padding: 12,
    borderWidth: 1, marginBottom: 10, gap: 12,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  scoreText: { fontSize: 12, fontWeight: "700" },
  reasons: { flex: 1, fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tile: { flex: 1, gap: 4 },
  tileImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: 6 },
  tileTitle: { fontSize: 12, fontWeight: "500" },
  tileMeta: { fontSize: 11 },
  arrow: { fontSize: 18, paddingHorizontal: 4 },
});
