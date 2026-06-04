import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import { router } from "expo-router";

import { useTheme } from "@/lib/theme";
import { useNews } from "@/lib/hooks/useNews";
import { newsItemToArticle } from "@/lib/article";

export type NewsAsset = { symbol: string; name: string };

/**
 * Sheet de "Noticias de economía" estilo app Bolsa de Apple: pestaña asomando
 * abajo (peek) → tira hacia arriba para la primera noticia → más arriba para el
 * feed completo con scroll. 3 detents. Solo en Cripto/Mercado.
 *
 * Las noticias (vía /api/news) son las de los activos registrados del usuario;
 * para activos sin cobertura, Yahoo devuelve economía generalista (que también
 * aporta). Las noticias que SÍ mencionan un activo tuyo (por símbolo o nombre)
 * se DESTACAN: borde de acento + chip con el símbolo.
 */
export function NewsSheet({ type, assets }: { type: "crypto" | "market"; assets: NewsAsset[] }) {
  const { th } = useTheme();
  const { items, loading, error } = useNews(type);
  const snapPoints = useMemo(() => ["11%", "42%", "90%"], []);
  const keywords = useMemo(() => buildKeywords(assets), [assets]);
  // Las noticias que mencionan un activo tuyo van PRIMERO (resaltadas), y dentro
  // de cada grupo se conserva el orden por fecha que ya trae el backend.
  const ordered = useMemo(() => {
    const withMatch = items.map((it) => ({
      it,
      matched: matchAssets(`${it.title} ${it.summary ?? ""}`, keywords),
    }));
    return [
      ...withMatch.filter((x) => x.matched.length > 0),
      ...withMatch.filter((x) => x.matched.length === 0),
    ];
  }, [items, keywords]);

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

        {ordered.map(({ it, matched }) => {
          const highlighted = matched.length > 0;
          return (
            <Pressable
              key={it.url}
              onPress={() =>
                router.push({
                  pathname: "/article",
                  params: { article: JSON.stringify(newsItemToArticle(it)) },
                } as never)
              }
              style={({ pressed }) => [
                styles.item,
                { borderBottomColor: th.border },
                highlighted && [styles.itemHighlighted, { borderLeftColor: th.accent, backgroundColor: th.accentSoft }],
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={styles.itemTop}>
                {it.source ? (
                  <Text style={[styles.itemSource, { color: th.textSubtle }]} numberOfLines={1}>
                    {it.source}
                  </Text>
                ) : (
                  <View style={styles.flex} />
                )}
                {matched.map((m) => (
                  <View key={m} style={[styles.chip, { backgroundColor: th.accent }]}>
                    <Text style={styles.chipText}>{m}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.itemTitle, { color: th.text }]} numberOfLines={3}>
                {it.title}
              </Text>
              {it.summary && (
                <Text style={[styles.itemSummary, { color: th.textMuted }]} numberOfLines={2}>
                  {it.summary}
                </Text>
              )}
              <Text style={[styles.itemTime, { color: th.textSubtle }]}>{timeAgo(it.publishedAt)}</Text>
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ── Matching de activos (cliente): resalta noticias que mencionan un activo ──
const STOP = new Set([
  "ETF", "UCITS", "ACC", "DIST", "INC", "CORP", "PLC", "USD", "EUR", "GBP",
  "FUND", "INDEX", "SHARES", "ISHARES", "CLASS", "HEDGED", "STOCK", "TRUST",
]);

type Kw = { label: string; res: RegExp[] };

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywords(assets: NewsAsset[]): Kw[] {
  const out: Kw[] = [];
  for (const a of assets) {
    const terms = new Set<string>();
    if (a.symbol) terms.add(a.symbol.trim());
    if (a.name) {
      for (const w of a.name.split(/[^A-Za-zÀ-ÿ0-9]+/)) {
        if (w.length >= 4 && !STOP.has(w.toUpperCase())) terms.add(w);
      }
    }
    const res = [...terms].filter(Boolean).map((t) => new RegExp(`\\b${escapeRe(t)}\\b`, "i"));
    if (res.length) out.push({ label: (a.symbol || a.name).toUpperCase().slice(0, 8), res });
  }
  return out;
}

function matchAssets(text: string, keywords: Kw[]): string[] {
  const hits = new Set<string>();
  for (const k of keywords) {
    if (k.res.some((re) => re.test(text))) hits.add(k.label);
  }
  return [...hits];
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
  flex: { flex: 1 },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemHighlighted: { borderLeftWidth: 3, paddingLeft: 12, marginLeft: -4, borderRadius: 6 },
  itemTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  itemSource: { fontSize: 11, flex: 1 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  chipText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  itemTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  itemSummary: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  itemTime: { fontSize: 11, marginTop: 6 },
});
