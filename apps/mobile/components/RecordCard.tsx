import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
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

export function RecordCard({ record }: { record: BaseRecord }) {
  if (record.type === "crypto") return <CryptoCard record={record} />;
  return <DefaultCard record={record} />;
}

// ── Cripto (estilo finanzas, sin imagen) ──────────────────────────────────
function CryptoCard({ record }: { record: BaseRecord }) {
  const { th } = useTheme();
  const symbol = metaField<string>(record, "symbol", record.title);
  const change = fmtChange(metaField<number | null>(record, "change24h", null));
  const volume = metaField<number | null>(record, "volume", null);
  const quote = metaField<string>(record, "quoteCurrency", "EUR");
  const spark = metaField<number[]>(record, "sparkline", []);
  const color = change.up ? UP : DOWN;

  return (
    <View style={[styles.card, styles.cryptoCard, { backgroundColor: th.surface, borderColor: th.border }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.symbol, { color: th.text }]}>{symbol}</Text>
          <Text style={[styles.coinName, { color: th.textMuted }]} numberOfLines={1}>{record.title}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.price, { color: th.text }]}>{record.primaryValue ?? "—"}</Text>
          <Text style={[styles.change, { color }]}>{change.text}</Text>
        </View>
      </View>

      <Sparkline data={spark} color={color} />

      <View style={[styles.cryptoFooter, { borderTopColor: th.border }]}>
        <Text style={[styles.volLabel, { color: th.textSubtle }]}>Vol. 24h</Text>
        <Text style={[styles.volValue, { color: th.textMuted }]}>{compactMoney(volume, quote)}</Text>
      </View>
    </View>
  );
}

/** Mini-gráfico de barras (sin dependencias nativas). */
function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return <View style={{ height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return (
    <View style={[styles.spark, { height }]}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(2, ((v - min) / range) * height),
            backgroundColor: color,
            marginHorizontal: 0.5,
            borderRadius: 1,
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
}

// ── Genérica (inmuebles y resto) ──────────────────────────────────────────
const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  FOR_SALE: { text: "En venta", color: "#15803D", bg: "#E8F1EC" },
  RESERVED: { text: "Reservado", color: "#A86A17", bg: "#F7EFDE" },
  SOLD: { text: "Vendido", color: "#666", bg: "#f3f3f3" },
  WITHDRAWN: { text: "Retirado", color: "#666", bg: "#f3f3f3" },
};

function DefaultCard({ record }: { record: BaseRecord }) {
  const { th } = useTheme();
  const cfg = recordTypeConfig(record.type);
  const status = record.status ? STATUS_LABEL[record.status] : undefined;
  const footnote = metaField<string | null>(record, "footnote", null);

  return (
    <Link href={`/property/${record.id}` as never} asChild>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}
      >
        {record.imageUrl ? (
          <Image
            source={{ uri: record.imageUrl }}
            style={[styles.image, { backgroundColor: th.imagePlaceholder }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.image, styles.placeholder, { backgroundColor: th.imagePlaceholder }]}>
            <Ionicons name={cfg.icon} size={28} color={th.textSubtle} />
          </View>
        )}

        {status && (
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: th.accent }]} numberOfLines={2}>{record.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name={cfg.icon} size={12} color={th.textMuted} />
            <Text style={[styles.meta, { color: th.textMuted }]} numberOfLines={1}>
              {record.subtitle ?? cfg.singular}
            </Text>
          </View>
          <View style={[styles.footer, { borderTopColor: th.border }]}>
            <Text style={[styles.primary, { color: th.accent }]}>{record.primaryValue ?? "—"}</Text>
            {footnote && (
              <Text style={[styles.footnote, { color: th.textMuted }]} numberOfLines={1}>{footnote}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
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
  card: { borderRadius: 10, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  // crypto
  cryptoCard: { padding: 14 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  alignEnd: { alignItems: "flex-end" },
  symbol: { fontSize: 16, fontWeight: "700" },
  coinName: { fontSize: 12, marginTop: 1 },
  price: { fontSize: 17, fontWeight: "700" },
  change: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  spark: { flexDirection: "row", alignItems: "flex-end", marginTop: 12 },
  cryptoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  volLabel: { fontSize: 11 },
  volValue: { fontSize: 12, fontWeight: "500" },
  // default
  image: { width: "100%", aspectRatio: 16 / 10 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  body: { padding: 12, gap: 4 },
  title: { fontSize: 14, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12, flex: 1 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  primary: { fontSize: 17, fontWeight: "700" },
  footnote: { fontSize: 11 },
});
