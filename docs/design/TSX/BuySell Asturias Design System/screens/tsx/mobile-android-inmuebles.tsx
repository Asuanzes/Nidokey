// ──────────────────────────────────────────────────────────────────────────
// screens/tsx/mobile-android-inmuebles.tsx
// Design spec for BuySell mobile — Android — Inmuebles screen.
// Stack: Expo Router + React Native + lucide-react-native + expo-status-bar +
// react-native-safe-area-context.
//
// Dependencies to install (likely missing from apps/mobile):
//   npm install lucide-react-native expo-status-bar react-native-safe-area-context
//
// Drop into apps/mobile/app/(tabs)/index.tsx OR create a new screen at
// apps/mobile/app/inmuebles.tsx and wire the Drawer/Sidebar in _layout.tsx.
// ──────────────────────────────────────────────────────────────────────────
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Building2, Search, Sparkles, LayoutDashboard, Activity, Download,
  User, Settings, MapPin, Bed, Bath, Maximize2, Plus, Image as ImageIcon,
  ArrowUp, ArrowDown, type LucideIcon,
} from "lucide-react-native";

// ──────────────────────────────────────────────────────────────────────────
// Tokens — mirrors the web's colors_and_type.css. In a real refactor,
// extract to apps/mobile/constants/tokens.ts and import everywhere.
// ──────────────────────────────────────────────────────────────────────────
const T = {
  bg: "#FAFAF7", surface: "#FFFFFF",
  surfaceMuted: "#F4F3EE", surfaceSunken: "#EFEEE8",
  border: "#E8E6E1", borderStrong: "#D4D1CA",
  text: "#1A1A18", textMuted: "#6B6862", textSubtle: "#9A9690",
  primary: "#3A5F8A", primaryHover: "#2E4D70",
  primarySoft: "#EAEFF6", primaryFg: "#FAFAF7",
  brass: "#C49A4D",
  success: "#2D6A4F", successSoft: "#E8F1EC",
  warning: "#A86A17", warningSoft: "#F7EFDE",
  danger:  "#A23E3E", dangerSoft:  "#F6E5E5",
  info:    "#2C7A8A", infoSoft:    "#E1EEF1",
  priceUpBg: "#FDF2F2", priceUpFg: "#A23E3E",
  priceDownBg: "#F0F7F2", priceDownFg: "#2D6A4F",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Nav model — same structure as web. Each group has an accent used on a 2px
// left bar of the ACTIVE item in the rail.
// ──────────────────────────────────────────────────────────────────────────
type RailItem = { id: string; label: string; Icon: LucideIcon; count?: number };
type RailGroup = { id: string; accent: ColorValue; items: RailItem[] };

const RAIL_GROUPS: RailGroup[] = [
  { id: "catalogo", accent: "#3A5F8A", items: [
    { id: "inmuebles",  label: "Inmuebles",  Icon: Building2 },
    { id: "duplicados", label: "Duplicados", Icon: Sparkles, count: 3 },
  ]},
  { id: "analisis", accent: "#2C7A8A", items: [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "actividad", label: "Actividad", Icon: Activity },
  ]},
  { id: "captura", accent: "#A86A17", items: [
    { id: "importar", label: "Importar", Icon: Download },
  ]},
];

const RAIL_FOOTER: RailItem[] = [
  { id: "perfil",  label: "Perfil",  Icon: User },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

// ──────────────────────────────────────────────────────────────────────────
// Brand mark
// ──────────────────────────────────────────────────────────────────────────
function BrandBadge() {
  return (
    <View style={s.brandBadge}>
      {/* Key SVG rendered inline via react-native-svg would be cleaner;
          using a unicode/text placeholder here keeps the file zero-extra-deps.
          REPLACE with the IconKey component from apps/mobile/components/brand/IconKey
          once you create it (port from src/components/brand/icons.tsx). */}
      <Text style={s.brandGlyph}>⚿</Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 56px-wide icon rail. Group separators are 1px hairlines.
// Active item: primary-soft background + 2px left bar in the group accent.
// ──────────────────────────────────────────────────────────────────────────
function Rail({
  current,
  onChange,
}: {
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={s.rail}>
      <View style={s.brandSlot}>
        <BrandBadge />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
        {RAIL_GROUPS.map((g, gi) => (
          <React.Fragment key={g.id}>
            {gi > 0 && <View style={s.railDivider} />}
            {g.items.map((it) => {
              const active = current === it.id;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => onChange(it.id)}
                  accessibilityRole="button"
                  accessibilityLabel={it.label}
                  style={[s.railItem, active && s.railItemActive]}
                >
                  {active && (
                    <View style={[s.railActiveBar, { backgroundColor: g.accent }]} />
                  )}
                  <it.Icon
                    size={18}
                    color={active ? T.primary : T.textMuted}
                    strokeWidth={2}
                  />
                  {it.count != null && (
                    <View style={s.railBadge}>
                      <Text style={s.railBadgeText}>{it.count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </React.Fragment>
        ))}
      </ScrollView>

      <View style={s.railFooter}>
        {RAIL_FOOTER.map((it) => (
          <Pressable
            key={it.id}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            style={s.railItem}
          >
            <it.Icon size={16} color={T.textSubtle} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mock data — REPLACE with real-data hook in production
// ──────────────────────────────────────────────────────────────────────────
type Property = {
  id: number; title: string; type: string;
  neighborhood: string | null; city: string;
  status: "FOR_SALE" | "RESERVED" | "SOLD" | "WITHDRAWN";
  price: number; rooms: number; baths: number; area: number;
  duplicates: number; delta: number;
};

const MOCK_PROPS: Property[] = [
  { id: 1, title: "Piso luminoso en La Manjoya con vistas", type: "Piso", neighborhood: "La Manjoya", city: "Oviedo", status: "FOR_SALE", price: 195000, rooms: 3, baths: 2, area: 95, duplicates: 2, delta: -3.7 },
  { id: 2, title: "Chalet pareado con jardín y garaje", type: "Chalet", neighborhood: "Cabueñes", city: "Gijón", status: "RESERVED", price: 385000, rooms: 4, baths: 3, area: 180, duplicates: 0, delta: 0 },
  { id: 3, title: "Ático con terraza en el centro", type: "Ático", neighborhood: "Centro", city: "Avilés", status: "FOR_SALE", price: 165000, rooms: 2, baths: 1, area: 72, duplicates: 1, delta: -2.4 },
  { id: 4, title: "Estudio reformado cerca de la playa", type: "Estudio", neighborhood: "San Lorenzo", city: "Gijón", status: "SOLD", price: 89000, rooms: 0, baths: 1, area: 35, duplicates: 0, delta: 0 },
];

const STATUS_MAP: Record<
  Property["status"],
  { label: string; bg: ColorValue; fg: ColorValue; border: ColorValue }
> = {
  FOR_SALE:  { label: "En venta",  bg: T.infoSoft,    fg: T.info,    border: "rgba(44,122,138,0.15)" },
  RESERVED:  { label: "Reservado", bg: T.warningSoft, fg: T.warning, border: "rgba(168,106,23,0.20)" },
  SOLD:      { label: "Vendido",   bg: T.successSoft, fg: T.success, border: "rgba(45,106,79,0.15)" },
  WITHDRAWN: { label: "Retirado",  bg: T.surfaceMuted,fg: T.textMuted, border: T.border },
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ s: stat }: { s: Property["status"] }) {
  const c = STATUS_MAP[stat];
  return (
    <View style={[s.statusBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[s.statusDot, { backgroundColor: c.fg }]} />
      <Text style={[s.statusText, { color: c.fg as string }]}>{c.label}</Text>
    </View>
  );
}

function PriceDelta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const down = pct < 0;
  const bg = down ? T.priceDownBg : T.priceUpBg;
  const fg = down ? T.priceDownFg : T.priceUpFg;
  const Icon = down ? ArrowDown : ArrowUp;
  return (
    <View style={[s.delta, { backgroundColor: bg }]}>
      <Icon size={10} color={fg} strokeWidth={2} />
      <Text style={[s.deltaText, { color: fg }]}>{Math.abs(pct).toFixed(1)}%</Text>
    </View>
  );
}

function PropertyCard({ p }: { p: Property }) {
  return (
    <Pressable style={({ pressed }) => [s.card, pressed && { opacity: 0.96 }]}>
      <View style={s.photo}>
        <ImageIcon size={26} color={T.textSubtle} strokeWidth={1.5} />
        <View style={s.photoBadgeTL}>
          <StatusBadge s={p.status} />
        </View>
        {p.duplicates > 0 && (
          <View style={s.dupBadge}>
            <Sparkles size={9} color={T.primary} strokeWidth={2} />
            <Text style={s.dupBadgeText}>{p.duplicates}</Text>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{p.title}</Text>
        <View style={s.cardRow}>
          <MapPin size={11} color={T.textMuted} strokeWidth={2} />
          <Text style={s.cardMeta} numberOfLines={1}>
            {p.type} · {p.neighborhood ? `${p.neighborhood}, ` : ""}{p.city}
          </Text>
        </View>
        <View style={s.cardPriceRow}>
          <Text style={s.cardPrice}>{fmtEUR(p.price)}</Text>
          <PriceDelta pct={p.delta} />
        </View>
        <View style={s.cardFooter}>
          <View style={s.cardRow}><Bed size={11} color={T.textMuted} strokeWidth={2} /><Text style={s.cardSpec}>{p.rooms}</Text></View>
          <View style={s.cardRow}><Bath size={11} color={T.textMuted} strokeWidth={2} /><Text style={s.cardSpec}>{p.baths}</Text></View>
          <View style={s.cardRow}><Maximize2 size={11} color={T.textMuted} strokeWidth={2} /><Text style={s.cardSpec}>{p.area} m²</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Screen
// ──────────────────────────────────────────────────────────────────────────
export default function InmueblesAndroidScreen() {
  const [current, setCurrent] = React.useState("inmuebles");
  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.root}>
      {/* expo-status-bar — Android uses translucent + dark icons here.
          On iOS the same component is fine; iconStyle dark works on both. */}
      <StatusBar style="dark" backgroundColor={T.surface} translucent={false} />

      <View style={s.row}>
        <Rail current={current} onChange={setCurrent} />

        <View style={s.content}>
          {/* Android Material-leaning header: 20px semibold title, FAB-ish + button */}
          <View style={s.header}>
            <View style={s.headerTop}>
              <View>
                <Text style={s.title}>Inmuebles</Text>
                <Text style={s.subtitle}>23 fichas · 4 nuevos esta semana</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nuevo inmueble"
                style={s.fab}
              >
                <Plus size={16} color={T.primaryFg} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View style={s.searchWrap}>
              <Search size={14} color={T.textSubtle} strokeWidth={2} style={s.searchIcon} />
              <TextInput
                placeholder="Buscar inmuebles, direcciones…"
                placeholderTextColor={T.textSubtle}
                style={s.search}
              />
            </View>
          </View>

          <ScrollView contentContainerStyle={s.list}>
            {MOCK_PROPS.map((p) => <PropertyCard key={p.id} p={p} />)}
            <Text style={s.eol}>— Fin de la lista —</Text>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Styles — equivalent to the web Tailwind classes the design spec used.
// Density tuned for 393×852 (Pixel 7 / iPhone 14). 13px body baseline.
// ──────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  row: { flex: 1, flexDirection: "row" },

  // Rail
  rail: { width: 56, backgroundColor: T.surface, borderRightWidth: 1, borderColor: T.border },
  brandSlot: { height: 56, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderColor: T.border },
  brandBadge: { width: 36, height: 36, borderRadius: 6, backgroundColor: T.primarySoft, alignItems: "center", justifyContent: "center" },
  brandGlyph: { color: T.primary, fontSize: 18, fontWeight: "600" },
  railDivider: { height: 1, marginVertical: 8, marginHorizontal: 12, backgroundColor: T.border },
  railItem: { width: 40, height: 40, marginHorizontal: 8, marginVertical: 2, borderRadius: 6, alignItems: "center", justifyContent: "center", position: "relative" },
  railItemActive: { backgroundColor: T.primarySoft },
  railActiveBar: { position: "absolute", left: -8, top: 6, bottom: 6, width: 2, borderRadius: 1 },
  railBadge: { position: "absolute", top: -2, right: -2, height: 16, minWidth: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: T.danger, alignItems: "center", justifyContent: "center" },
  railBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", fontVariant: ["tabular-nums"] },
  railFooter: { borderTopWidth: 1, borderColor: T.border, paddingVertical: 8 },

  // Content area
  content: { flex: 1 },
  header: { backgroundColor: T.surface, borderBottomWidth: 1, borderColor: T.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { color: T.text, fontSize: 20, fontWeight: "600", letterSpacing: -0.2 },
  subtitle: { color: T.textMuted, fontSize: 12, marginTop: 2 },
  fab: { width: 36, height: 36, borderRadius: 999, backgroundColor: T.primary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  searchWrap: { position: "relative", marginTop: 12 },
  searchIcon: { position: "absolute", left: 12, top: 13, zIndex: 1 },
  search: { height: 36, paddingLeft: 36, paddingRight: 12, borderWidth: 1, borderColor: T.border, borderRadius: 6, backgroundColor: T.bg, color: T.text, fontSize: 13 },

  list: { padding: 12, gap: 12, paddingBottom: 24 },
  eol: { textAlign: "center", color: T.textSubtle, fontSize: 11, marginVertical: 16 },

  // Card
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 8, overflow: "hidden" },
  photo: { aspectRatio: 16 / 10, backgroundColor: T.surfaceMuted, alignItems: "center", justifyContent: "center" },
  photoBadgeTL: { position: "absolute", top: 10, left: 10 },
  dupBadge: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 6 },
  dupBadgeText: { color: T.primary, fontSize: 10, fontWeight: "500" },

  cardBody: { padding: 12, gap: 8 },
  cardTitle: { color: T.text, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMeta: { color: T.textMuted, fontSize: 12, flex: 1 },
  cardPriceRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  cardPrice: { color: T.text, fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
  cardFooter: { flexDirection: "row", gap: 16, paddingTop: 8, borderTopWidth: 1, borderColor: T.border },
  cardSpec: { color: T.textMuted, fontSize: 11, fontVariant: ["tabular-nums"] },

  // Status badge
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderRadius: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 999, opacity: 0.7 },
  statusText: { fontSize: 11, fontWeight: "500" },

  // Price delta
  delta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  deltaText: { fontSize: 11, fontWeight: "500", fontVariant: ["tabular-nums"] },
});
