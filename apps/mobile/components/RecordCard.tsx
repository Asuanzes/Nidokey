import { useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { type BaseRecord, metaField } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";
import { recordTypeConfig } from "@/lib/records/config";

/**
 * Tarjeta de registro. Genérica para la mayoría de tipos; con un layout
 * específico para CRIPTO (símbolo · precio · %24h · mini-gráfico · volumen).
 */

const UP = "#15803D";
const DOWN = "#B91C1C";

type CardProps = {
  record: BaseRecord;
  /** Modo edición: muestra el botón ✕ para borrar. */
  editing?: boolean;
  /** Pulsación larga sobre la tarjeta (entra en modo edición). */
  onLongPress?: () => void;
  /** Borrado: lo gestiona la pantalla (confirma + llama al backend). */
  onDelete?: (record: BaseRecord) => void;
};

export function RecordCard(props: CardProps) {
  if (props.record.type === "crypto") return <CryptoCard {...props} />;
  return <DefaultCard {...props} />;
}

function fireLongPress(onLongPress?: () => void) {
  if (!onLongPress) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  onLongPress();
}

/** Botón ✕ rojo en la esquina de la tarjeta (modo edición). */
function DeleteBadge({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Eliminar"
      style={styles.deleteBadge}
    >
      <Ionicons name="close" size={15} color="#fff" />
    </Pressable>
  );
}

// ── Cripto (estilo finanzas, sin imagen) ──────────────────────────────────
function CryptoCard({ record, editing, onLongPress, onDelete }: CardProps) {
  const { th } = useTheme();
  const symbol = metaField<string>(record, "symbol", record.title);
  const change = fmtChange(metaField<number | null>(record, "change24h", null));
  const volume = metaField<number | null>(record, "volume", null);
  const marketCap = metaField<number | null>(record, "marketCap", null);
  const quote = metaField<string>(record, "quoteCurrency", "EUR");
  const spark = metaField<number[]>(record, "sparkline", []);
  // El % grande va por el cambio de 24h; el gráfico por la tendencia de 7 días
  // (precio actual vs. hace 7 días). Verde sube / rojo baja en ambos casos.
  const changeColor = change.up ? UP : DOWN;
  const trendUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : change.up;
  const trendColor = trendUp ? UP : DOWN;

  return (
    <Pressable
      onLongPress={onLongPress ? () => fireLongPress(onLongPress) : undefined}
      delayLongPress={300}
      style={[styles.card, styles.cryptoCard, { backgroundColor: th.surface, borderColor: th.border }]}
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.symbol, { color: th.text }]}>{symbol}</Text>
          <Text style={[styles.coinName, { color: th.textMuted }]} numberOfLines={1}>{record.title}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.price, { color: th.text }]}>{record.primaryValue ?? "—"}</Text>
          <View style={styles.changeRow}>
            <Text style={[styles.change, { color: changeColor }]}>{change.text}</Text>
            <Text style={[styles.periodLabel, { color: th.textSubtle }]}>24h</Text>
          </View>
        </View>
      </View>

      <View style={styles.sparkHeader}>
        <Text style={[styles.periodLabel, { color: th.textSubtle }]}>7 días</Text>
      </View>
      <PriceChart price={spark} color={trendColor} />

      <View style={[styles.cryptoFooter, { borderTopColor: th.border }]}>
        <View>
          <Text style={[styles.statLabel, { color: th.textSubtle }]}>Cap. mercado</Text>
          <Text style={[styles.statValue, { color: th.textMuted }]}>{compactMoney(marketCap, quote)}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.statLabel, { color: th.textSubtle }]}>Vol. 24h</Text>
          <Text style={[styles.statValue, { color: th.textMuted }]}>{compactMoney(volume, quote)}</Text>
        </View>
      </View>

      {editing && onDelete && <DeleteBadge onPress={() => onDelete(record)} />}
    </Pressable>
  );
}

/**
 * Mini-gráfico de precio 7d (sin dependencias nativas), estilo CoinGecko:
 *  - relleno TENUE = precio (contexto), mismo color de tendencia,
 *  - línea de tendencia SUAVIZADA y sólida (SMA de ventana amplia, poco sinuosa),
 *    dibujada con segmentos `View` rotados (técnica sin react-native-svg).
 * El color (verde/rojo) lo decide la tendencia de 7 días; buena lectura en claro
 * y oscuro al ser un color sólido sobre relleno muy tenue.
 */
function PriceChart({ price, color, height = 44 }: { price: number[]; color: string; height?: number }) {
  const [width, setWidth] = useState(0);
  if (!price || price.length < 2) return <View style={{ height }} />;

  const min = Math.min(...price);
  const max = Math.max(...price);
  const range = max - min || 1;
  const norm = (v: number) => (v - min) / range; // 0 (mín) … 1 (máx)
  // Ventana amplia ⇒ línea de tendencia suave (no “sinuosa”).
  const smooth = movingAverage(price, Math.max(3, Math.round(price.length / 4)));

  return (
    <View style={[styles.chart, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.barsRow}>
        {price.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(1, norm(v) * height),
              backgroundColor: color,
              marginHorizontal: 0.4,
              opacity: 0.16,
            }}
          />
        ))}
      </View>
      {width > 0 && <TrendLine series={smooth} norm={norm} width={width} height={height} color={color} />}
    </View>
  );
}

/** Línea de tendencia (segmentos rotados, sin SVG). */
function TrendLine({
  series,
  norm,
  width,
  height,
  color,
}: {
  series: (number | null)[];
  norm: (v: number) => number;
  width: number;
  height: number;
  color: string;
}) {
  const n = series.length;
  const thickness = 2.5;
  const xAt = (i: number) => ((i + 0.5) / n) * width;
  const yAt = (v: number) => (1 - norm(v)) * height; // 0 arriba … height abajo
  const segments: ReactNode[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = series[i];
    const b = series[i + 1];
    if (a == null || b == null) continue;
    const x1 = xAt(i);
    const y1 = yAt(a);
    const x2 = xAt(i + 1);
    const y2 = yAt(b);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    segments.push(
      <View
        key={i}
        style={{
          position: "absolute",
          left: (x1 + x2) / 2 - len / 2,
          top: (y1 + y2) / 2 - thickness / 2,
          width: len,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}rad` }],
        }}
      />,
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {segments}
    </View>
  );
}

/** Media móvil simple (SMA). Devuelve null hasta completar la ventana. */
function movingAverage(data: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += data[j];
    out.push(sum / window);
  }
  return out;
}

// ── Genérica (inmuebles y resto) ──────────────────────────────────────────
const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  FOR_SALE: { text: "En venta", color: "#15803D", bg: "#E8F1EC" },
  RESERVED: { text: "Reservado", color: "#A86A17", bg: "#F7EFDE" },
  SOLD: { text: "Vendido", color: "#666", bg: "#f3f3f3" },
  WITHDRAWN: { text: "Retirado", color: "#666", bg: "#f3f3f3" },
};

function DefaultCard({ record, editing, onLongPress, onDelete }: CardProps) {
  const { th } = useTheme();
  const cfg = recordTypeConfig(record.type);
  const status = record.status ? STATUS_LABEL[record.status] : undefined;
  const footnote = metaField<string | null>(record, "footnote", null);

  return (
    <Pressable
      onPress={() => {
        if (editing) return;
        if (record.type === "property") { router.push(`/property/${record.id}` as never); return; }
        const url = metaField<string | null>(record, "url", null);
        if (url) void Linking.openURL(url);
      }}
      onLongPress={onLongPress ? () => fireLongPress(onLongPress) : undefined}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.card,
        styles.narrowCard,
        { backgroundColor: th.surface, borderColor: th.border },
        pressed && !editing && { opacity: 0.7 },
      ]}
    >
      {record.imageUrl ? (
        <Image
          source={{ uri: record.imageUrl }}
          style={[styles.thumb, { backgroundColor: th.imagePlaceholder }]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: th.imagePlaceholder }]}>
          <Ionicons name={cfg.icon} size={26} color={th.textSubtle} />
        </View>
      )}

      <View style={styles.info}>
        <View>
          <Text style={[styles.title, { color: th.accent }]} numberOfLines={2}>{record.title}</Text>
          {record.subtitle && (
            <Text style={[styles.sub, { color: th.textMuted }]} numberOfLines={1}>{record.subtitle}</Text>
          )}
          {footnote && (
            <Text style={[styles.foot, { color: th.textSubtle }]} numberOfLines={1}>{footnote}</Text>
          )}
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.cardPrice, { color: th.accent }]} numberOfLines={1}>{record.primaryValue ?? "—"}</Text>
          {status && (
            <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
          )}
        </View>
      </View>

      {editing && onDelete && <DeleteBadge onPress={() => onDelete(record)} />}
    </Pressable>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
function fmtChange(p: number | null): { text: string; up: boolean } {
  if (p == null) return { text: "—", up: true };
  const up = p >= 0;
  return { text: `${up ? "+" : ""}${p.toFixed(2).replace(".", ",")}%`, up };
}

function compactMoney(n: number | null, currency = "EUR"): string {
  if (n == null) return "—";
  const sym = currency.toUpperCase() === "EUR" ? "€" : currency.toUpperCase();
  const abs = Math.abs(n);
  const fmt = (x: number) => x.toFixed(x >= 100 ? 0 : 1).replace(".", ",");
  if (abs >= 1e9) return `${fmt(n / 1e9)} B ${sym}`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M ${sym}`;
  if (abs >= 1e3) return `${fmt(n / 1e3)} k ${sym}`;
  return `${Math.round(n)} ${sym}`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  deleteBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  // crypto
  cryptoCard: { padding: 14 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  alignEnd: { alignItems: "flex-end" },
  symbol: { fontSize: 16, fontWeight: "700" },
  coinName: { fontSize: 12, marginTop: 1 },
  price: { fontSize: 17, fontWeight: "700" },
  changeRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 1 },
  change: { fontSize: 13, fontWeight: "600" },
  periodLabel: { fontSize: 10, fontWeight: "500" },
  sparkHeader: { alignItems: "flex-end", marginTop: 10 },
  chart: { position: "relative", marginTop: 4 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", height: "100%" },
  cryptoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  // default (tarjeta estrecha: miniatura izquierda + info derecha)
  narrowCard: { flexDirection: "row", padding: 10, gap: 12, alignItems: "stretch" },
  thumb: { width: 88, height: 88, borderRadius: 8 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, justifyContent: "space-between", minHeight: 88 },
  title: { fontSize: 14, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 2 },
  foot: { fontSize: 11, marginTop: 2 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  cardPrice: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  statusChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "600" },
});
