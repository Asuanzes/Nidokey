import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";

import { formatPrice } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";

export type PropertyCardData = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  type: string;
  status: string;
  currentPrice: number | null;
  rooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  media: { url: string }[];
};

const TYPE_LABEL: Record<string, string> = {
  PISO: "Piso", HOUSE: "Casa", ATICO: "Ático", CHALET: "Chalet",
  DUPLEX: "Dúplex", ESTUDIO: "Estudio", LOFT: "Loft", LOCAL: "Local",
  TERRENO: "Terreno", OTRO: "Otro",
};

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  FOR_SALE: { text: "En venta", color: "#15803D", bg: "#E8F1EC" },
  RESERVED: { text: "Reservado", color: "#A86A17", bg: "#F7EFDE" },
  SOLD: { text: "Vendido", color: "#666", bg: "#f3f3f3" },
  WITHDRAWN: { text: "Retirado", color: "#666", bg: "#f3f3f3" },
};

export function PropertyCard({ p }: { p: PropertyCardData }) {
  const { th } = useTheme();
  const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.FOR_SALE;
  return (
    <Link href={`/property/${p.id}` as never} asChild>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}
      >
        {p.media[0] ? (
          <Image
            source={{ uri: p.media[0].url }}
            style={[styles.image, { backgroundColor: th.imagePlaceholder }]}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: th.imagePlaceholder, alignItems: "center", justifyContent: "center" }]}>
            <Text style={[styles.placeholderText, { color: th.textSubtle }]}>Sin foto</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: th.accent }]} numberOfLines={2}>{p.title}</Text>
          <Text style={[styles.meta, { color: th.textMuted }]}>
            {TYPE_LABEL[p.type] ?? p.type} · {p.neighborhood ? `${p.neighborhood}, ` : ""}{p.city}
          </Text>
          <View style={[styles.footer, { borderTopColor: th.border }]}>
            <Text style={[styles.price, { color: th.accent }]}>{formatPrice(p.currentPrice)}</Text>
            <Text style={[styles.features, { color: th.textMuted }]}>
              {p.rooms != null ? `${p.rooms} hab` : "—"}
              {p.bathrooms != null ? ` · ${p.bathrooms} baño${p.bathrooms !== 1 ? "s" : ""}` : ""}
              {p.builtArea != null ? ` · ${p.builtArea} m²` : ""}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  image: { width: "100%", aspectRatio: 16 / 10 },
  placeholderText: { fontSize: 12 },
  badge: {
    position: "absolute", top: 10, left: 10,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  body: { padding: 12, gap: 4 },
  title: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12 },
  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
    marginTop: 8, paddingTop: 8, borderTopWidth: 1,
  },
  price: { fontSize: 17, fontWeight: "700" },
  features: { fontSize: 11 },
});
