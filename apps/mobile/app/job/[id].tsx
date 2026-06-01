import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { type BaseRecord, metaField } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { provinceImage } from "@/lib/records/province-images";

/**
 * Ficha propia de un empleo guardado. Muestra los datos scrapeados (lugar,
 * sueldo, contrato, descripción…) sin redirigir a LinkedIn/InfoJobs; ofrece un
 * botón para abrir la oferta original si el usuario quiere.
 */
export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th } = useTheme();
  const [record, setRecord] = useState<BaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<BaseRecord>(`/api/records/${id}?type=job`);
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
        <Stack.Screen options={{ title: "Empleo" }} />
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }
  if (error || !record) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ title: "Empleo" }} />
        <Text style={{ color: th.dangerFg }}>{error ?? "No encontrado"}</Text>
      </View>
    );
  }

  const company = metaField<string | null>(record, "company", null);
  const location = metaField<string | null>(record, "location", null);
  const salary = metaField<string | null>(record, "salaryLabel", null) ?? record.primaryValue ?? null;
  const contract = metaField<string | null>(record, "contractType", null);
  const experience = metaField<string | null>(record, "experienceLevel", null);
  const sector = metaField<string | null>(record, "sector", null);
  const remote = metaField<boolean | null>(record, "remote", null);
  const platform = metaField<string | null>(record, "platform", null);
  const description = metaField<string | null>(record, "description", null);
  const url = metaField<string | null>(record, "url", null);
  const applyUrl = metaField<string | null>(record, "applyUrl", null);
  const postedAt = metaField<string | null>(record, "postedAt", null);
  const province = metaField<string | null>(record, "province", null);
  const banner = provinceImage(province);
  const platformLabel = platform === "linkedin" ? "LinkedIn" : platform === "infojobs" ? "InfoJobs" : "la web";

  const rows: [string, string][] = (
    [
      ["Empresa", company],
      ["Ubicación", location],
      ["Contrato / jornada", contract],
      ["Experiencia", experience],
      ["Sector", sector],
      ["Modalidad", remote ? "Remoto" : null],
      ["Publicado", postedAt ? new Date(postedAt).toLocaleDateString("es-ES") : null],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <>
      <Stack.Screen options={{ title: "Empleo" }} />
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
        {banner && (
          <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" transition={200} />
        )}
        {banner && province && (
          <Text style={[styles.bannerCaption, { color: th.textSubtle }]}>{province} · Wikimedia</Text>
        )}
        <Text style={[styles.title, { color: th.text }]}>{record.title}</Text>
        {(company || location) && (
          <Text style={[styles.sub, { color: th.textMuted }]}>
            {[company, location].filter(Boolean).join(" · ")}
          </Text>
        )}
        {salary && <Text style={[styles.salary, { color: th.accent }]}>{salary}</Text>}

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

        {description && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.descTitle, { color: th.textMuted }]}>Descripción</Text>
            <Text style={[styles.descText, { color: th.text }]}>{description}</Text>
          </View>
        )}

        {url && (
          <Pressable
            onPress={() => void Linking.openURL(applyUrl || url)}
            style={[styles.cta, { backgroundColor: th.primary }]}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>Ver oferta en {platformLabel}</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 6, paddingBottom: 40 },
  banner: { width: "100%", height: 150, borderRadius: 12 },
  bannerCaption: { fontSize: 10, textAlign: "right", marginTop: -2 },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 14, marginTop: 2 },
  salary: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  rowKey: { fontSize: 13 },
  rowVal: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  descTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  descText: { fontSize: 14, lineHeight: 20 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 10,
    marginTop: 16,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
