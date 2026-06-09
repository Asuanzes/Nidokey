import { useState } from "react";
import { fonts } from "@/lib/fonts";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { formatPrice } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useRecord } from "@/lib/hooks/useRecord";
import { fetchPropertyDetail, type PropertyDetail } from "@/lib/records/property";
import { toolsForType, type ToolDef } from "@/lib/records/tools";
import { CategoryContextSheet } from "@/components/CategoryContextSheet";
import { ResultModal } from "@/components/ui";

type Notice = { tone: "success" | "error" | "info"; title: string; message?: string };

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
  const insets = useSafeAreaInsets();
  const { data: p, error, refetch } = useRecord<PropertyDetail>(
    () => fetchPropertyDetail(id!),
    [id],
    { enabled: !!id }
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Re-check: re-consulta cada anuncio vinculado y refresca el detalle.
  async function recheck() {
    if (!p) return;
    if (p.listings.length === 0) {
      setNotice({ tone: "info", title: "Sin anuncios", message: "Este inmueble no tiene anuncios vinculados que actualizar." });
      return;
    }
    setBusyTool("recheck");
    try {
      for (const l of p.listings) {
        await api("/api/listings/check", { method: "POST", body: JSON.stringify({ listingId: l.id }) });
      }
      await refetch();
      setSheetOpen(false);
      setNotice({ tone: "success", title: "Precio actualizado", message: "Se han revisado los anuncios vinculados." });
    } catch (e) {
      setNotice({ tone: "error", title: "No se pudo actualizar", message: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setBusyTool(null);
    }
  }

  // Dispatch del panel contextual por id de herramienta.
  function handleTool(tool: ToolDef) {
    if (!p) return;
    switch (tool.id) {
      case "recheck":
        void recheck();
        return;
      case "mortgage":
        setSheetOpen(false);
        router.push(`/tools/mortgage?amount=${p.currentPrice ? Math.round(p.currentPrice / 100) : ""}` as never);
        return;
      case "catastro":
        setSheetOpen(false);
        router.push(`/tools/catastro?ref=${encodeURIComponent(p.cadastralRef ?? "")}` as never);
        return;
      case "registro":
        setSheetOpen(false);
        router.push("/tools/registro" as never);
        return;
      case "ine":
        setSheetOpen(false);
        router.push(`/tools/ine?city=${encodeURIComponent(p.city ?? "")}` as never);
        return;
      case "share":
        setSheetOpen(false);
        void Share.share({
          message: [p.title, formatPrice(p.currentPrice), p.listings[0]?.url].filter(Boolean).join("\n"),
        });
        return;
    }
  }

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
          <Text style={[styles.title, { color: th.text }]}>{p.title}</Text>
          <Text style={[styles.location, { color: th.textMuted }]}>
            {[TYPE_LABEL[p.type], p.neighborhood, p.city, p.province].filter(Boolean).join(" · ")}
          </Text>
          <Text style={[styles.price, { color: th.accent }]}>{formatPrice(p.currentPrice)}</Text>
          {p.builtArea && p.currentPrice && (
            <Text style={[styles.pricePerSqm, { color: th.accent }]}>
              {Math.round(p.currentPrice / 100 / p.builtArea).toLocaleString("es-ES")} €/m²
            </Text>
          )}
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Herramientas del inmueble"
            hitSlop={8}
            style={({ pressed }) => [styles.toolsFab, { backgroundColor: th.primary }, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="construct" size={20} color="#fff" />
          </Pressable>
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
                  <Text style={[styles.listingMeta, { color: th.accent }]}>{formatPrice(l.lastPrice)}</Text>
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

      <View style={[styles.floatBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <FloatButton icon="chevron-back" onPress={() => router.back()} />
      </View>

      <CategoryContextSheet
        visible={sheetOpen}
        title="Herramientas del inmueble"
        tools={toolsForType("property")}
        busyToolId={busyTool}
        onClose={() => setSheetOpen(false)}
        onSelect={handleTool}
      />

      <ResultModal
        visible={!!notice}
        tone={notice?.tone ?? "info"}
        title={notice?.title ?? ""}
        message={notice?.message}
        actions={[{ label: "Entendido", onPress: () => setNotice(null) }]}
        onRequestClose={() => setNotice(null)}
      />
    </View>
  );
}

function FloatButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.floatBtn}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
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
  floatBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  floatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  title: { fontSize: 18, fontFamily: fonts.bodyBold },
  location: { fontSize: 13, marginTop: 4 },
  price: { fontSize: 26, fontFamily: fonts.bodyBold, marginTop: 12 },
  toolsFab: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pricePerSqm: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontFamily: fonts.bodySemibold,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  // 4 columnas × 2 filas (antes 2 col × 4 filas): gana mucho espacio vertical.
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  spec: { width: "23%" },
  specLabel: { fontSize: 10 },
  specValue: { fontSize: 14, fontFamily: fonts.bodyMedium, marginTop: 2 },
  tags: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    marginTop: 16, paddingTop: 12, borderTopWidth: 1,
  },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
  },
  tagText: { fontSize: 11, fontFamily: fonts.bodyMedium },
  description: { fontSize: 13, lineHeight: 20 },
  listingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1,
  },
  listingPortal: { fontSize: 14, fontFamily: fonts.bodyMedium },
  listingMeta: { fontSize: 12, marginTop: 2 },
  cadastral: { fontSize: 12, fontFamily: "monospace" },
});
