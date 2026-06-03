import { useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { useTheme } from "@/lib/theme";
import { useNews } from "@/lib/hooks/useNews";

/**
 * Sheet de "Noticias de economía" estilo app Bolsa de Apple: pestaña asomando
 * abajo (peek) → tira hacia arriba para ver la primera noticia → más arriba para
 * el feed completo con scroll. 3 detents. Solo se muestra en Cripto/Mercado y
 * trae noticias de los activos REGISTRADOS del usuario (vía /api/news).
 */
export function NewsSheet({ type }: { type: "crypto" | "market" }) {
  const { th } = useTheme();
  const { items, loading, error } = useNews(type);
  const snapPoints = useMemo(() => ["11%", "42%", "90%"], []);

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      backgroundStyle={[styles.bg, { backgroundColor: th.surface }]}
      handleIndicatorStyle={{ backgroundColor: th.textSubtle, width: 36 }}
      style={styles.sheetShadow}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.header, { color: th.text }]}>Noticias de economía</Text>
        <Text style={[styles.sub, { color: th.textMuted }]}>De Yahoo! Finanzas</Text>
        <View style={[styles.divider, { backgroundColor: th.border }]} />

        {loading && items.length === 0 && <ActivityIndicator color={th.primary} style={styles.loader} />}
        {error && <Text style={[styles.empty, { color: th.dangerFg }]}>{error}</Text>}
        {!loading && !error && items.length === 0 && (
          <Text style={[styles.empty, { color: th.textSubtle }]}>
            No hay noticias de tus activos ahora mismo.
          </Text>
        )}

        {items.map((it, i) => (
          <Pressable
            key={`${it.url}-${i}`}
            onPress={() => void Linking.openURL(it.url)}
            style={({ pressed }) => [
              styles.item,
              { borderBottomColor: th.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            {it.source && <Text style={[styles.itemSource, { color: th.textSubtle }]}>{it.source}</Text>}
            <Text style={[styles.itemTitle, { color: th.text }]} numberOfLines={3}>
              {it.title}
            </Text>
            {it.summary && (
              <Text style={[styles.itemSummary, { color: th.textMuted }]} numberOfLines={2}>
                {it.summary}
              </Text>
            )}
            <Text style={[styles.itemTime, { color: th.textSubtle }]}>
              {timeAgo(it.publishedAt)}
              {it.symbol ? ` · ${it.symbol}` : ""}
            </Text>
          </Pressable>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

const styles = StyleSheet.create({
  bg: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  sheetShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  content: { paddingHorizontal: 18, paddingBottom: 48 },
  header: { fontSize: 22, fontWeight: "800" },
  sub: { fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 14, marginBottom: 2 },
  loader: { marginTop: 24 },
  empty: { fontSize: 13, paddingVertical: 22, textAlign: "center" },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemSource: { fontSize: 11, marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  itemSummary: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  itemTime: { fontSize: 11, marginTop: 6 },
});
