import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatPrice } from "@buysell/shared";
import { api } from "@/lib/api";

const SCREEN_WIDTH = Dimensions.get("window").width;

type PropertyDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  currentPrice: number | null;
  address: string | null;
  city: string;
  province: string;
  neighborhood: string | null;
  rooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  usableArea: number | null;
  plotArea: number | null;
  floor: string | null;
  yearBuilt: number | null;
  hasElevator: boolean | null;
  hasGarage: boolean | null;
  hasStorage: boolean | null;
  hasTerrace: boolean | null;
  hasFireplace: boolean | null;
  hasGarden: boolean | null;
  hasPool: boolean | null;
  energyRating: string;
  cadastralRef: string | null;
  tags: string[];
  media: { id: string; kind: string; url: string }[];
  listings: { id: string; portal: string; url: string; lastPrice: number | null; lastCheckedAt: string | null }[];
};

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

const TYPE_LABEL: Record<string, string> = {
  PISO: "Piso", HOUSE: "Casa", ATICO: "Ático", CHALET: "Chalet",
  DUPLEX: "Dúplex", ESTUDIO: "Estudio", LOFT: "Loft", LOCAL: "Local",
  TERRENO: "Terreno", OTRO: "Otro",
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<PropertyDetail>(`/api/properties/${id}`)
      .then(setP)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: "Error" }} />
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!p) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#3A5F8A" />
      </View>
    );
  }

  const photos = p.media.filter((m) => m.kind === "PHOTO");

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: p.title.slice(0, 30),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 12 }}>
              <Ionicons name="chevron-back" size={24} color="#3A5F8A" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Gallery swipeable */}
        {photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
          >
            {photos.map((m) => (
              <Image
                key={m.id}
                source={{ uri: m.url }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.66 }}
                contentFit="cover"
                transition={150}
              />
            ))}
          </ScrollView>
        )}
        <Text style={styles.photoCount}>📸 {photos.length} fotos</Text>

        <View style={styles.section}>
          <Text style={styles.title}>{p.title}</Text>
          <Text style={styles.location}>
            {[TYPE_LABEL[p.type], p.neighborhood, p.city, p.province].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.price}>{formatPrice(p.currentPrice)}</Text>
          {p.builtArea && p.currentPrice && (
            <Text style={styles.pricePerSqm}>
              {Math.round(p.currentPrice / 100 / p.builtArea).toLocaleString("es-ES")} €/m²
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Características</Text>
          <View style={styles.grid}>
            <Spec label="Habitaciones" value={p.rooms ?? "—"} />
            <Spec label="Baños" value={p.bathrooms ?? "—"} />
            <Spec label="Construidos" value={p.builtArea ? `${p.builtArea} m²` : "—"} />
            <Spec label="Útiles" value={p.usableArea ? `${p.usableArea} m²` : "—"} />
            <Spec label="Parcela" value={p.plotArea ? `${p.plotArea} m²` : "—"} />
            <Spec label="Planta" value={p.floor ?? "—"} />
            <Spec label="Año" value={p.yearBuilt ?? "—"} />
            <Spec label="Energía" value={p.energyRating !== "UNKNOWN" ? p.energyRating : "—"} />
          </View>
          <View style={styles.tags}>
            {[
              { v: p.hasElevator, label: "Ascensor" },
              { v: p.hasGarage, label: "Garaje" },
              { v: p.hasStorage, label: "Trastero" },
              { v: p.hasTerrace, label: "Terraza" },
              { v: p.hasFireplace, label: "Chimenea" },
              { v: p.hasGarden, label: "Jardín" },
              { v: p.hasPool, label: "Piscina" },
            ]
              .filter((x) => x.v)
              .map((x) => (
                <View key={x.label} style={styles.tag}>
                  <Text style={styles.tagText}>{x.label}</Text>
                </View>
              ))}
          </View>
        </View>

        {p.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>{p.description}</Text>
          </View>
        )}

        {p.listings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Anuncios vinculados</Text>
            {p.listings.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={styles.listingRow}
                onPress={() => Linking.openURL(l.url)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.listingPortal}>{PORTAL_LABEL[l.portal] ?? l.portal}</Text>
                  <Text style={styles.listingMeta}>{formatPrice(l.lastPrice)}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color="#3A5F8A" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {p.cadastralRef && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Catastro</Text>
            <Text style={styles.cadastral}>{p.cadastralRef}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF7" },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#B91C1C", fontSize: 13 },
  gallery: { height: SCREEN_WIDTH * 0.66, backgroundColor: "#000" },
  photoCount: {
    fontSize: 11, color: "#666", textAlign: "right",
    paddingHorizontal: 16, paddingTop: 6,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 12, marginTop: 12,
    padding: 16, borderRadius: 10,
    borderWidth: 1, borderColor: "#e5e5e5",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  location: { fontSize: 13, color: "#666", marginTop: 4 },
  price: { fontSize: 26, fontWeight: "700", color: "#1a1a1a", marginTop: 12 },
  pricePerSqm: { fontSize: 12, color: "#666", marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: "600", color: "#666",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
  },
  spec: { width: "47%" },
  specLabel: { fontSize: 11, color: "#666" },
  specValue: { fontSize: 14, fontWeight: "500", color: "#1a1a1a", marginTop: 2 },
  tags: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: "#EAEFF6", borderRadius: 4,
  },
  tagText: { fontSize: 11, color: "#3A5F8A", fontWeight: "500" },
  description: { fontSize: 13, color: "#1a1a1a", lineHeight: 20 },
  listingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  listingPortal: { fontSize: 14, fontWeight: "500", color: "#1a1a1a" },
  listingMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  cadastral: { fontSize: 12, fontFamily: "monospace", color: "#1a1a1a" },
});
