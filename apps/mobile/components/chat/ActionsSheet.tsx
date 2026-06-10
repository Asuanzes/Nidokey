import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";

export type SheetOption = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  danger?: boolean;
};

/**
 * Bottom sheet genérico de acciones del chat (menú de cabecera, silenciar…).
 * Mismo patrón visual que CategoryContextSheet: Modal nativo + safe-area, sin
 * dependencias nativas nuevas (entregable por OTA).
 */
export function ActionsSheet({
  visible,
  title,
  options,
  busy = false,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  /** Cargando estado del menú (contactos/bloqueos): muestra spinner. */
  busy?: boolean;
  onSelect: (option: SheetOption) => void;
  onClose: () => void;
}) {
  const { th } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: th.surface, borderColor: th.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: th.border }]} />
        <Text style={[styles.title, { color: th.text }]} numberOfLines={1}>
          {title}
        </Text>

        {busy ? (
          <ActivityIndicator color={th.primary} style={styles.spinner} />
        ) : (
          options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: th.imagePlaceholder }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: o.danger ? th.dangerSoft : th.primarySoft }]}>
                <Ionicons name={o.icon} size={18} color={o.danger ? th.dangerFg : th.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: o.danger ? th.dangerFg : th.text }]}>{o.label}</Text>
                {o.hint && (
                  <Text style={[styles.rowHint, { color: th.textSubtle }]} numberOfLines={1}>
                    {o.hint}
                  </Text>
                )}
              </View>
            </Pressable>
          ))
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  title: { fontSize: 16, fontFamily: fonts.bodyBold, paddingHorizontal: 4, marginBottom: 8 },
  spinner: { marginVertical: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: fonts.bodyMedium },
  rowHint: { fontSize: 12, marginTop: 1 },
});
