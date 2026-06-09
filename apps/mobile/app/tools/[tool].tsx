import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card } from "@/components/ui";

/**
 * Pantallas de herramienta del panel contextual de Inmuebles: Catastro, Registro
 * de la Propiedad y Estadísticas de zona (INE). De momento **solo diseño/UI**;
 * la integración real con OVC / Registro / INE queda como TODO (banners
 * "pendiente"). Los datos disponibles llegan por query params (ref, city).
 */
const TITLES: Record<string, string> = {
  catastro: "Catastro",
  registro: "Registro de la Propiedad",
  ine: "Estadísticas de zona",
};

export default function ToolScreen() {
  const { th } = useTheme();
  const { tool, ref, city } = useLocalSearchParams<{ tool?: string; ref?: string; city?: string }>();
  const key = tool ?? "";
  const title = TITLES[key] ?? "Herramienta";

  return (
    <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title }} />
      {key === "catastro" && <Catastro refValue={ref} />}
      {key === "registro" && <Registro />}
      {key === "ine" && <Ine city={city} />}
      {!TITLES[key] && (
        <Text style={{ color: th.textMuted, padding: 8 }}>Herramienta no disponible.</Text>
      )}
    </ScrollView>
  );
}

// ── Catastro ───────────────────────────────────────────────────────────────
function Catastro({ refValue }: { refValue?: string }) {
  const { th } = useTheme();
  const has = !!refValue;
  return (
    <>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: th.textMuted }]}>Referencia catastral</Text>
        <Text style={[styles.mono, { color: has ? th.text : th.textSubtle }]}>
          {has ? refValue : "No disponible"}
        </Text>
      </Card>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: th.textMuted }]}>Datos del inmueble (OVC)</Text>
        <InfoRow label="Superficie construida" value="—" />
        <InfoRow label="Uso principal" value="—" />
        <InfoRow label="Año de construcción" value="—" />
        <InfoRow label="Planta" value="—" />
      </Card>
      {has && (
        <Button
          label="Buscar en el Catastro"
          icon="open-outline"
          variant="secondary"
          onPress={() =>
            Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(`catastro ${refValue}`)}`)
          }
        />
      )}
      <Pending text="Integración ampliada con la Sede del Catastro (OVC) por referencia: pendiente." />
    </>
  );
}

// ── Registro de la Propiedad ─────────────────────────────────────────────────
function Registro() {
  const { th } = useTheme();
  return (
    <>
      <PlaceholderCard title="Titularidad" body="Titular(es) y porcentaje de propiedad." />
      <PlaceholderCard title="Cargas y gravámenes" body="Hipotecas, embargos, servidumbres y afecciones." />
      <PlaceholderCard title="Nota simple" body="Descripción de la finca registral y su historial." />
      <Pending text="Consulta al Registro de la Propiedad (nota simple): pendiente. Es un servicio oficial normalmente de pago." />
      <Text style={[styles.note, { color: th.textSubtle }]}>
        Aquí se mostrará la información registral del inmueble cuando se integre el
        servicio.
      </Text>
    </>
  );
}

// ── Estadísticas de zona (INE) ───────────────────────────────────────────────
function Ine({ city }: { city?: string }) {
  const { th } = useTheme();
  return (
    <>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: th.textMuted }]}>
          Zona{city ? `: ${city}` : ""}
        </Text>
        <InfoRow label="Precio medio de venta" value="— €/m²" />
        <InfoRow label="Variación interanual" value="—" />
        <InfoRow label="Renta media estimada" value="— €/mes" />
        <InfoRow label="Transacciones (último año)" value="—" />
        <InfoRow label="Rentabilidad bruta del alquiler" value="—" />
      </Card>
      <Pending text="Estadísticas por geolocalización (INE / Catastro): pendiente de integración." />
    </>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  const { th } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: th.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: th.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  const { th } = useTheme();
  return (
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: th.textMuted }]}>{title}</Text>
      <Text style={[styles.cardBody, { color: th.textSubtle }]}>{body}</Text>
    </Card>
  );
}

function Pending({ text }: { text: string }) {
  const { th } = useTheme();
  return (
    <View style={[styles.pending, { backgroundColor: th.accentSoft, borderColor: th.border }]}>
      <Ionicons name="construct-outline" size={15} color={th.accent} />
      <Text style={[styles.pendingText, { color: th.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 32, gap: 12 },
  card: {},
  cardTitle: {
    fontSize: 11,
    fontFamily: fonts.bodySemibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  cardBody: { fontSize: 13, lineHeight: 19 },
  mono: { fontSize: 14, fontFamily: "monospace" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 13, flex: 1 },
  rowValue: { fontSize: 14, fontFamily: fonts.bodyMedium, marginLeft: 12 },
  pending: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pendingText: { fontSize: 12, lineHeight: 17, flex: 1 },
  note: { fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
});
