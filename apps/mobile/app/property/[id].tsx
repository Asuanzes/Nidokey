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
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatPrice } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";
import { useRecord } from "@/lib/hooks/useRecord";
import { fetchPropertyDetail, type PropertyDetail } from "@/lib/records/property";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
  const { th } = useTheme();
  const { data: p, error } = useRecord<PropertyDetail>(
    () => fetchPropertyDetail(id!),
    [id],
    { enabled: !!id }
  );

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={{ color: th.dangerFg, fontSize: 13 }}>{error.message}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!p) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: th.bg }]}>
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }

  const photos = p.media.filter((m) => m.kind === "PHOTO");

  return (
    <View style={[styles.container, { backgroundColor: th.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
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
        <Text style={[styles.photoCount, { color: th.textMuted }]}>📸 {photos.length} fotos</Text>

        <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.title, { color: th.accent }]}>{p.title}</Text>
          <Text style={[styles.location, { color: th.textMuted }]}>
            {[TYPE_LABEL[p.type], p.neighborhood, p.city, p.province].filter(Boolean).join(" · ")}
          </Text>
          <Text style={[styles.price, { color: th.accent }]}>{formatPrice(p.currentPrice)}</Text>
          {p.builtArea && p.currentPrice && (
            <Text style={[styles.pricePerSqm, { color: th.textMuted }]}>
              {Math.round(p.currentPrice / 100 / p.builtArea).toLocaleString("es-ES")} €/m²
            </Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
          <Text style={[styles.sectionTitle, { color: th.textMuted }]}>Características</Text>
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
          <View style={[styles.tags, { borderTopColor: th.border }]}>
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
                <View key={x.label} style={[styles.tag, { backgroundColor: th.primarySoft }]}>
                  <Text style={[styles.tagText, { color: th.primary }]}>{x.label}</Text>
                </View>
              ))}
          </View>
        </View>

        {p.description && (
          <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.sectionTitle, { color: th.textMuted }]}>Descripción</Text>
            <Text style={[styles.description, { color: th.text }]}>{p.description}</Text>
          </View>
        )}

        {p.listings.length > 0 && (
          <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.sectionTitle, { color: th.textMuted }]}>Anuncios vinculados</Text>
            {p.listings.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.listingRow, { borderBottomColor: th.border }]}
                onPress={() => Linking.openURL(l.url)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listingPortal, { color: th.text }]}>{PORTAL_LABEL[l.portal] ?? l.portal}</Text>
                  <Text style={[styles.listingMeta, { color: th.textMuted }]}>{formatPrice(l.lastPrice)}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={th.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {p.cadastralRef && (
          <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.sectionTitle, { color: th.textMuted }]}>Catastro</Text>
            <Text style={[styles.cadastral, { color: th.text }]}>{p.cadastralRef}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  const { th } = useTheme();
  return (
    <View style={styles.spec}>
      <Text style={[styles.specLabel, { color: th.textMuted }]}>{label}</Text>
      <Text style={[styles.specValue, { color: th.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  gallery: { height: SCREEN_WIDTH * 0.66, backgroundColor: "#000" },
  photoCount: {
    fontSize: 11, textAlign: "right",
    paddingHorizontal: 16, paddingTop: 6,
  },
  section: {
    marginHorizontal: 12, marginTop: 12,
    padding: 16, borderRadius: 10,
    borderWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "700" },
  location: { fontSize: 13, marginTop: 4 },
  price: { fontSize: 26, fontWeight: "700", marginTop: 12 },
  pricePerSqm: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  spec: { width: "47%" },
  specLabel: { fontSize: 11 },
  specValue: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  tags: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    marginTop: 16, paddingTop: 12, borderTopWidth: 1,
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
  },
  tagText: { fontSize: 11, fontWeight: "500" },
  description: { fontSize: 13, lineHeight: 20 },
  listingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1,
  },
  listingPortal: { fontSize: 14, fontWeight: "500" },
  listingMeta: { fontSize: 12, marginTop: 2 },
  cadastral: { fontSize: 12, fontFamily: "monospace" },
});
