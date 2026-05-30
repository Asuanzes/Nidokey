import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { type BaseRecord, metaField } from "@nidokey/shared";
import { useTheme } from "@/lib/theme";
import { recordTypeConfig } from "@/lib/records/config";

/**
 * Tarjeta GENÉRICA para cualquier registro. Trabaja contra `BaseRecord`, así
 * que sirve igual para inmuebles, criptos, empleos… La apariencia específica
 * del tipo (icono, color) viene de RECORD_TYPE_CONFIG.
 *
 * Reemplaza a PropertyCard manteniendo su diseño visual.
 */

/** Estados conocidos → etiqueta + colores. Si el estado no está mapeado, no
 * se muestra badge (mantiene la tarjeta limpia para tipos futuros). */
const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  FOR_SALE: { text: "En venta", color: "#15803D", bg: "#E8F1EC" },
  RESERVED: { text: "Reservado", color: "#A86A17", bg: "#F7EFDE" },
  SOLD: { text: "Vendido", color: "#666", bg: "#f3f3f3" },
  WITHDRAWN: { text: "Retirado", color: "#666", bg: "#f3f3f3" },
};

/** Ruta de detalle por tipo. Hoy solo property; al añadir tipos se amplía. */
function detailHref(record: BaseRecord): string {
  if (record.type === "property") return `/property/${record.id}`;
  return `/property/${record.id}`; // placeholder hasta que existan otras rutas
}

export function RecordCard({ record }: { record: BaseRecord }) {
  const { th } = useTheme();
  const cfg = recordTypeConfig(record.type);
  const status = record.status ? STATUS_LABEL[record.status] : undefined;
  const footnote = metaField<string | null>(record, "footnote", null);

  return (
    <Link href={detailHref(record) as never} asChild>
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
          <View
            style={[styles.image, styles.placeholder, { backgroundColor: th.imagePlaceholder }]}
          >
            <Ionicons name={cfg.icon} size={28} color={th.textSubtle} />
          </View>
        )}

        {status && (
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: th.accent }]} numberOfLines={2}>
            {record.title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name={cfg.icon} size={12} color={th.textMuted} />
            <Text style={[styles.meta, { color: th.textMuted }]} numberOfLines={1}>
              {record.subtitle ?? cfg.singular}
            </Text>
          </View>
          <View style={[styles.footer, { borderTopColor: th.border }]}>
            <Text style={[styles.primary, { color: th.accent }]}>
              {record.primaryValue ?? "—"}
            </Text>
            {footnote && (
              <Text style={[styles.footnote, { color: th.textMuted }]} numberOfLines={1}>
                {footnote}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  image: { width: "100%", aspectRatio: 16 / 10 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
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
