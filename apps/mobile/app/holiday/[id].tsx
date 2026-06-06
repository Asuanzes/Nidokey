import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import {
  type BaseRecord,
  metaField,
  formatMoney,
  type TransportLeg,
  type AccommodationChoice,
} from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Ficha de un VIAJE guardado (record `holiday`). Muestra destino, fechas,
 * alojamiento y desplazamiento con sus precios y el Total. Botones para reservar
 * (in-app browser). ⚠️ La comisión es interna: NUNCA se lee ni se pinta aquí.
 */
export default function HolidayDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th } = useTheme();
  const [record, setRecord] = useState<BaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<BaseRecord>(`/api/records/${id}?type=holiday`);
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
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ title: "Viaje" }} />
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }
  if (error || !record) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ title: "Viaje" }} />
        <Text style={{ color: th.dangerFg }}>{error ?? "No encontrado"}</Text>
      </View>
    );
  }

  const destination = metaField<string | null>(record, "destination", null);
  const accommodation = metaField<AccommodationChoice | null>(record, "accommodation", null);
  const transport = metaField<TransportLeg | null>(record, "transport", null);
  const tripType = metaField<string | null>(record, "tripType", null);
  const occupancy = metaField<{ adults: number; children: number[] }[] | null>(record, "occupancy", null);
  // ⚠️ NO leer metaField(record, "commission", …): es interno, no se pinta.

  const occSummary =
    occupancy && occupancy.length
      ? `${occupancy.length} hab. · ${occupancy.reduce((s, r) => s + (r.adults ?? 0), 0)} adultos` +
        (occupancy.flatMap((r) => r.children ?? []).length
          ? ` · ${occupancy.flatMap((r) => r.children ?? []).length} niños`
          : "")
      : null;

  const rows: [string, string][] = (
    [
      ["Destino", destination],
      ["Tipo", tripType],
      ["Fechas", record.subtitle],
      ["Viajeros", occSummary],
      [
        "Alojamiento",
        accommodation
          ? `${accommodation.name}${accommodation.priceCents != null ? ` · ${formatMoney(accommodation.priceCents, accommodation.currency ?? "EUR")}` : ""}`
          : null,
      ],
      [
        "Desplazamiento",
        transport
          ? `${transport.provider ?? "Vuelo"}${transport.priceCents != null ? ` · ${formatMoney(transport.priceCents, transport.currency ?? "EUR")}` : ""}`
          : null,
      ],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <>
      <Stack.Screen options={{ title: "Viaje" }} />
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
        {record.imageUrl ? (
          <Image source={{ uri: record.imageUrl }} style={styles.hero} contentFit="cover" transition={200} />
        ) : null}
        <Text style={[styles.title, { color: th.text }]}>{record.title}</Text>
        {record.primaryValue ? (
          <Text style={[styles.total, { color: th.accent }]}>{record.primaryValue}</Text>
        ) : null}

        {rows.length > 0 && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={[styles.rowKey, { color: th.textSubtle }]}>{k}</Text>
                <Text style={[styles.rowVal, { color: th.text }]}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {accommodation?.affiliateUrl ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(accommodation.affiliateUrl!)}
            style={[styles.outlineBtn, { borderColor: th.border }]}
          >
            <Ionicons name="bed-outline" size={18} color={th.accent} />
            <Text style={{ color: th.accent, fontWeight: "600" }}>Reservar alojamiento</Text>
          </Pressable>
        ) : null}
        {transport?.affiliateUrl ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(transport.affiliateUrl!)}
            style={[styles.outlineBtn, { borderColor: th.border }]}
          >
            <Ionicons name="airplane-outline" size={18} color={th.accent} />
            <Text style={{ color: th.accent, fontWeight: "600" }}>Ver vuelo</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  hero: { width: "100%", height: 160, borderRadius: 12 },
  title: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  total: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  rowKey: { fontSize: 13 },
  rowVal: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 10, borderWidth: 1, marginTop: 10 },
});
