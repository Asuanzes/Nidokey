import { useState, type ComponentProps, type ReactNode } from "react";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { type BaseRecord, metaField } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";
import { recordTypeConfig } from "@/lib/records/config";
import { provinceImage } from "@/lib/records/province-images";
import { marketLogoUrl } from "@/lib/records/market-logo";

/**
 * Tarjeta de registro. Genérica para la mayoría de tipos; con un layout
 * específico para CRIPTO (símbolo · precio · %24h · mini-gráfico · volumen).
 */

const UP = "#15803D";
const DOWN = "#B91C1C";
const STALE = "#A86A17"; // ámbar: datos rancios (el refresco no está corriendo)

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
  if (props.record.type === "crypto" || props.record.type === "market") return <CryptoCard {...props} />;
  if (props.record.type === "job") return <JobCard {...props} />;
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

/**
 * Logo del activo a la izquierda del nombre (cripto/acción/ETF). Chip circular
 * blanco para que se lean tanto los logos transparentes claros como oscuros. Si
 * no hay logo o la carga falla (p. ej. 404 de FMP), cae al icono del tipo.
 */
function AssetLogo({
  uri,
  icon,
  iconColor,
  placeholderBg,
  borderColor,
}: {
  uri: string | null;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  placeholderBg: string;
  borderColor: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.logo, { backgroundColor: placeholderBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
    );
  }
  return (
    <View style={[styles.logo, styles.logoChip, { borderColor }]}>
      <Image
        source={{ uri }}
        style={styles.logoImg}
        contentFit="contain"
        transition={150}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

// ── Cripto (estilo finanzas, con logo del activo) ─────────────────────────
function CryptoCard({ record, editing, onLongPress, onDelete }: CardProps) {
  const { th } = useTheme();
  const cfg = recordTypeConfig(record.type);
  const symbol = metaField<string>(record, "symbol", record.title);
  const change = fmtChange(metaField<number | null>(record, "change24h", null));
  const volume = metaField<number | null>(record, "volume", null);
  const marketCap = metaField<number | null>(record, "marketCap", null);
  const quote = metaField<string>(record, "quoteCurrency", "EUR");
  const spark = metaField<number[]>(record, "sparkline", []);
  const ago = fmtAgo(metaField<string | null>(record, "lastCheckedAt", null));
  const isMarket = record.type === "market";
  const exchange = metaField<string | null>(record, "exchange", null);
  // Cripto: logo de CoinGecko (ya en imageUrl). Mercado: emisor (ETF) vía CDN de
  // Twelve Data o ticker vía FMP; derivado en cliente → registros ya guardados
  // muestran logo sin reimportar.
  const logoUri = isMarket ? marketLogoUrl({ title: record.title, symbol }) : record.imageUrl ?? null;
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
        <AssetLogo
          uri={logoUri}
          icon={cfg.icon}
          iconColor={th.textSubtle}
          placeholderBg={th.imagePlaceholder}
          borderColor={th.border}
        />
        <View style={styles.flex}>
          <Text style={[styles.symbol, { color: th.text }]}>{symbol}</Text>
          <Text style={[styles.coinName, { color: th.textMuted }]} numberOfLines={1}>{record.title}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.price, { color: th.accent }]}>{record.primaryValue ?? "—"}</Text>
          <View style={styles.changeRow}>
            <Text style={[styles.change, { color: changeColor }]}>{change.text}</Text>
            <Text style={[styles.periodLabel, { color: th.textSubtle }]}>{isMarket ? "día" : "24h"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sparkHeader}>
        {ago ? (
          <Text style={[styles.periodLabel, { color: ago.stale ? STALE : th.textSubtle }]}>
            {ago.text}
          </Text>
        ) : (
          <View />
        )}
        <Text style={[styles.periodLabel, { color: th.textSubtle }]}>7 días</Text>
      </View>
      <PriceChart price={spark} color={trendColor} height={36} />

      <View style={[styles.cryptoFooter, { borderTopColor: th.border }]}>
        <View>
          <Text style={[styles.statLabel, { color: th.textSubtle }]}>{isMarket ? "Bolsa" : "Cap. mercado"}</Text>
          <Text style={[styles.statValue, { color: th.textMuted }]}>
            {isMarket ? (exchange ?? "—") : compactMoney(marketCap, quote)}
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.statLabel, { color: th.textSubtle }]}>{isMarket ? "Volumen" : "Vol. 24h"}</Text>
          <Text style={[styles.statValue, { color: th.textMuted }]}>
            {isMarket ? compactNumber(volume) : compactMoney(volume, quote)}
          </Text>
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
      onPress={() => { if (!editing) router.push(`/property/${record.id}` as never); }}
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
        <Text style={[styles.title, { color: th.text }]} numberOfLines={2}>{record.title}</Text>
        {record.subtitle && (
          <Text style={[styles.sub, { color: th.textMuted }]} numberOfLines={1}>{record.subtitle}</Text>
        )}
        {footnote && (
          <Text style={[styles.foot, { color: th.textSubtle }]} numberOfLines={1}>{footnote}</Text>
        )}
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

// ── Empleo (miniatura = capital de la provincia; estilo inmuebles, compacto) ─
function JobCard({ record, editing, onLongPress, onDelete }: CardProps) {
  const { th } = useTheme();
  const company = metaField<string | null>(record, "company", null);
  const location = metaField<string | null>(record, "location", null);
  const salary = metaField<string | null>(record, "salaryLabel", null) ?? record.primaryValue ?? null;
  const contract = metaField<string | null>(record, "contractType", null);
  const remote = metaField<boolean | null>(record, "remote", null);
  const platform = metaField<string | null>(record, "platform", null);
  const thumb = provinceImage(metaField<string | null>(record, "province", null));
  const sub = [company, location].filter(Boolean).join(" · ") || record.subtitle || null;
  // Pie compacto: contrato (· remoto) en gris, sueldo en BRONCE; fuente a la derecha.
  const contractRemote = [contract, remote ? "Remoto" : null].filter(Boolean).join(" · ");
  const platformLabel =
    platform === "linkedin"
      ? "LinkedIn"
      : platform === "infojobs"
      ? "InfoJobs"
      : platform === "indeed"
      ? "Indeed"
      : null;

  return (
    <Pressable
      onPress={() => { if (!editing) router.push(`/job/${record.id}` as never); }}
      onLongPress={onLongPress ? () => fireLongPress(onLongPress) : undefined}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.card,
        styles.narrowCard,
        { backgroundColor: th.surface, borderColor: th.border },
        pressed && !editing && { opacity: 0.7 },
      ]}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={[styles.thumb, { backgroundColor: th.imagePlaceholder }]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: th.imagePlaceholder }]}>
          <Ionicons name="briefcase-outline" size={24} color={th.textSubtle} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.title, { color: th.text }]} numberOfLines={2}>{record.title}</Text>
        {sub && <Text style={[styles.sub, { color: th.textMuted }]} numberOfLines={1}>{sub}</Text>}
        {(contractRemote || salary || platformLabel) && (
          <View style={styles.jobFooter}>
            <Text style={[styles.jobFooterLeft, { color: th.textMuted }]} numberOfLines={1}>
              {contractRemote}
              {salary ? (
                <Text style={{ color: th.accent, fontWeight: "700" }}>
                  {contractRemote ? "  ·  " : ""}
                  {salary}
                </Text>
              ) : !contractRemote ? (
                "—"
              ) : null}
            </Text>
            {platformLabel && (
              <Text style={[styles.jobFooterRight, { color: th.textSubtle }]}>{platformLabel}</Text>
            )}
          </View>
        )}
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

/**
 * "Actualizado hace X" a partir de la hora del último refresco real
 * (`lastCheckedAt`). `stale` (≥30 min) lo pinta en ámbar para avisar de que el
 * reloj de refresco no está corriendo. Devuelve null si no hay dato.
 */
function fmtAgo(iso: string | null): { text: string; stale: boolean } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return { text: "Actualizado ahora", stale: false };
  if (mins < 60) return { text: `Actualizado hace ${mins} min`, stale: mins >= 30 };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { text: `Actualizado hace ${hrs} h`, stale: true };
  return { text: `Actualizado hace ${Math.floor(hrs / 24)} d`, stale: true };
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

/** Número compacto SIN moneda (p. ej. volumen de bolsa en acciones). */
function compactNumber(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const fmt = (x: number) => x.toFixed(x >= 100 ? 0 : 1).replace(".", ",");
  if (abs >= 1e9) return `${fmt(n / 1e9)} B`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M`;
  if (abs >= 1e3) return `${fmt(n / 1e3)} k`;
  return `${Math.round(n)}`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, marginBottom: 8 },
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
  cryptoCard: { padding: 12 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 10,
  },
  logoChip: { backgroundColor: "#fff", borderWidth: 1 },
  logoImg: { width: 30, height: 30 },
  flex: { flex: 1 },
  alignEnd: { alignItems: "flex-end" },
  symbol: { fontSize: 16, fontWeight: "700" },
  coinName: { fontSize: 12, marginTop: 1 },
  price: { fontSize: 17, fontWeight: "700" },
  changeRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 1 },
  change: { fontSize: 13, fontWeight: "600" },
  periodLabel: { fontSize: 10, fontWeight: "500" },
  sparkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  chart: { position: "relative", marginTop: 4 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", height: "100%" },
  cryptoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  // empleo: pie compacto (contrato·sueldo | fuente)
  jobFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 },
  jobFooterLeft: { flex: 1, fontSize: 12, fontWeight: "500" },
  jobFooterRight: { fontSize: 11 },
  // tarjeta estrecha (miniatura izquierda + info derecha) — compacta
  narrowCard: { flexDirection: "row", padding: 8, gap: 10, alignItems: "center" },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: "600" },
  sub: { fontSize: 12 },
  foot: { fontSize: 11 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
    gap: 8,
  },
  cardPrice: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  statusChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "600" },
});
