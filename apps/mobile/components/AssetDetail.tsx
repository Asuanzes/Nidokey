import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LineChart } from "react-native-wagmi-charts";

import { type BaseRecord, metaField } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { marketLogoUrl } from "@/lib/records/market-logo";

/**
 * Detalle de un activo (cripto o mercado), estilo Yahoo Finanzas:
 * cabecera (logo · símbolo · nombre · precio · cambio · bolsa/moneda) +
 * selector de rangos + gráfico interactivo (scrub con el dedo) + grid de stats.
 *
 * v1: el gráfico usa el histórico ya guardado (`meta.detail.snapshots`) con
 * fallback al `sparkline`. Los rangos filtran ese histórico. v2 (pendiente):
 * endpoint `/api/records/[id]/chart?range=` con histórico real de Yahoo/CoinGecko
 * y stats extra (Apertura/Máx/Mín/52S).
 */

const UP = "#15803D";
const DOWN = "#B91C1C";

type Snapshot = { value: number; observedAt: string };
type Point = { timestamp: number; value: number };

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "1D", label: "1D", days: 1 },
  { key: "1S", label: "1S", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1A", label: "1A", days: 365 },
  { key: "MAX", label: "Máx", days: null },
];

export function AssetDetail({ type }: { type: "crypto" | "market" }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th } = useTheme();
  const [record, setRecord] = useState<BaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState("1S");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await api<BaseRecord>(`/api/records/${id}?type=${type}`);
        if (alive) setRecord(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, type]);

  // ── Serie de precios (histórico de snapshots, en unidades de precio) ──
  const fullSeries = useMemo<Point[]>(() => {
    if (!record) return [];
    const detail = metaField<{ snapshots?: Snapshot[] } | null>(record, "detail", null);
    const snaps = detail?.snapshots ?? [];
    const pts: Point[] = snaps
      .map((s) => ({ timestamp: Date.parse(s.observedAt), value: s.value / 100 }))
      .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.value));
    if (pts.length >= 2) return pts;
    // Fallback: sparkline (sin timestamps reales → equiespaciado hacia atrás).
    const spark = metaField<number[]>(record, "sparkline", []);
    if (spark.length >= 2) {
      const now = Date.now();
      const step = (7 * 24 * 3600 * 1000) / (spark.length - 1);
      return spark.map((v, i) => ({ timestamp: now - (spark.length - 1 - i) * step, value: v }));
    }
    return [];
  }, [record]);

  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const series = useMemo<Point[]>(() => {
    if (range.days == null) return fullSeries;
    const cutoff = Date.now() - range.days * 24 * 3600 * 1000;
    const filtered = fullSeries.filter((p) => p.timestamp >= cutoff);
    return filtered.length >= 2 ? filtered : fullSeries; // si no hay datos en el rango, muestra todo
  }, [fullSeries, range]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }
  if (error || !record) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Text style={{ color: th.dangerFg }}>{error ?? "No encontrado"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: th.primary }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isMarket = type === "market";
  const symbol = metaField<string>(record, "symbol", record.title);
  const quote = metaField<string>(record, "quoteCurrency", "EUR");
  const change = metaField<number | null>(record, "change24h", null);
  const volume = metaField<number | null>(record, "volume", null);
  const marketCap = metaField<number | null>(record, "marketCap", null);
  const exchange = metaField<string | null>(record, "exchange", null);
  const logoUri = isMarket ? marketLogoUrl({ title: record.title, symbol }) : record.imageUrl ?? null;

  // Precio actual (de la serie si existe; si no, no podemos parsear primaryValue de forma fiable).
  const lastPrice = series.length ? series[series.length - 1].value : null;
  const up = (change ?? 0) >= 0;
  const trendColor = series.length >= 2 ? (series[series.length - 1].value >= series[0].value ? UP : DOWN) : up ? UP : DOWN;
  // Cambio absoluto estimado a partir del % de 24h (Yahoo lo muestra así).
  const absChange =
    lastPrice != null && change != null ? lastPrice - lastPrice / (1 + change / 100) : null;

  const stats: [string, string][] = [
    ["Cambio", change != null ? `${up ? "+" : ""}${change.toFixed(2).replace(".", ",")} %` : "—"],
    [isMarket ? "Volumen" : "Vol. 24h", compactNumber(volume, isMarket ? "" : quote)],
    [isMarket ? "Bolsa" : "Cap. mercado", isMarket ? exchange ?? "—" : compactNumber(marketCap, quote)],
    ["Moneda", quote],
  ];

  return (
    <View style={[styles.flex, { backgroundColor: th.bg }]}>
      {/* ── Barra superior: cerrar / compartir ── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.iconBtn, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Ionicons name="close" size={20} color={th.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.iconBtn, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Ionicons name="share-outline" size={18} color={th.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Cabecera ── */}
        <View style={styles.headerRow}>
          {logoUri ? (
            <View style={[styles.logoChip, isMarket && styles.logoSquare, { borderColor: th.border }]}>
              <Image source={{ uri: logoUri }} style={styles.logoImg} contentFit="contain" transition={150} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Text style={[styles.symbol, { color: th.text }]}>{symbol}</Text>
            <Text style={[styles.name, { color: th.textMuted }]} numberOfLines={2}>
              {record.title}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: th.border }]} />

        {/* ── Precio + cambio ── */}
        <View style={styles.priceBlock}>
          <Text style={[styles.price, { color: th.text }]}>
            {record.primaryValue ?? (lastPrice != null ? formatPrice(lastPrice, quote) : "—")}
          </Text>
          <Text style={[styles.changeBig, { color: up ? UP : DOWN }]}>
            {change != null
              ? `${up ? "+" : ""}${absChange != null ? formatNum(absChange) + "  " : ""}(${up ? "+" : ""}${change
                  .toFixed(2)
                  .replace(".", ",")} %)`
              : "—"}
          </Text>
          <Text style={[styles.subMuted, { color: th.textSubtle }]}>
            {[isMarket ? exchange : null, quote].filter(Boolean).join(" · ")}
          </Text>
        </View>

        {/* ── Pills de rango ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {RANGES.map((r) => {
            const active = r.key === rangeKey;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRangeKey(r.key)}
                style={[styles.pill, active && { backgroundColor: th.accentSoft }]}
              >
                <Text style={[styles.pillText, { color: active ? th.accent : th.textMuted }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Gráfico interactivo ── */}
        {series.length >= 2 ? (
          <LineChart.Provider data={series}>
            <LineChart height={CHART_H}>
              <LineChart.Path color={trendColor} width={2}>
                <LineChart.Gradient color={trendColor} />
              </LineChart.Path>
              <LineChart.CursorCrosshair color={trendColor}>
                <LineChart.Tooltip
                  textStyle={{ backgroundColor: th.surface, color: th.text, borderRadius: 6, fontSize: 12, padding: 4 }}
                />
              </LineChart.CursorCrosshair>
            </LineChart>
            <View style={styles.scrubRow}>
              <LineChart.DatetimeText
                style={[styles.scrubDate, { color: th.textSubtle }]}
                locale="es-ES"
                options={{ day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }}
              />
              <LineChart.PriceText
                style={[styles.scrubPrice, { color: th.textMuted }]}
                format={({ value }) => {
                  "worklet";
                  const n = Number(value);
                  const sym = quote === "EUR" ? "€" : quote === "USD" ? "$" : quote;
                  return `${n.toFixed(2).replace(".", ",")} ${sym}`;
                }}
              />
            </View>
          </LineChart.Provider>
        ) : (
          <View style={[styles.noChart, { height: CHART_H }]}>
            <Text style={{ color: th.textSubtle, fontSize: 12 }}>Aún no hay histórico para el gráfico.</Text>
          </View>
        )}

        {/* ── Stats ── */}
        <View style={[styles.statsCard, { backgroundColor: th.surface, borderColor: th.border }]}>
          {stats.map(([k, v]) => (
            <View key={k} style={styles.statRow}>
              <Text style={[styles.statKey, { color: th.textSubtle }]}>{k}</Text>
              <Text style={[styles.statVal, { color: th.text }]}>{v}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const CHART_H = 220;

// ── helpers ──
function formatPrice(n: number, quote = "EUR"): string {
  const sym = quote.toUpperCase() === "EUR" ? "€" : quote.toUpperCase() === "USD" ? "$" : quote.toUpperCase();
  return `${formatNum(n)} ${sym}`;
}
function formatNum(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function compactNumber(n: number | null, suffix = ""): string {
  if (n == null) return "—";
  const sym = suffix.toUpperCase() === "EUR" ? " €" : suffix ? ` ${suffix.toUpperCase()}` : "";
  const abs = Math.abs(n);
  const fmt = (x: number) => x.toFixed(x >= 100 ? 0 : 1).replace(".", ",");
  if (abs >= 1e9) return `${fmt(n / 1e9)} B${sym}`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M${sym}`;
  if (abs >= 1e3) return `${fmt(n / 1e3)} k${sym}`;
  return `${Math.round(n)}${sym}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  backLink: { padding: 8 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  logoChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoSquare: { borderRadius: 10 },
  logoImg: { width: 34, height: 34 },
  symbol: { fontSize: 30, fontWeight: "800", letterSpacing: 0.3 },
  name: { fontSize: 14, marginTop: 1 },
  divider: { height: 1, marginVertical: 14 },
  priceBlock: { gap: 3 },
  price: { fontSize: 30, fontWeight: "700" },
  changeBig: { fontSize: 16, fontWeight: "600" },
  subMuted: { fontSize: 13, marginTop: 2 },
  pills: { gap: 6, paddingVertical: 16 },
  pill: { paddingHorizontal: 14, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pillText: { fontSize: 14, fontWeight: "700" },
  scrubRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  scrubDate: { fontSize: 11 },
  scrubPrice: { fontSize: 13, fontWeight: "600" },
  noChart: { alignItems: "center", justifyContent: "center" },
  statsCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginTop: 20 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 },
  statKey: { fontSize: 13 },
  statVal: { fontSize: 13, fontWeight: "600" },
});
