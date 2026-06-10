import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import type { ToolDef } from "@/lib/records/tools";

/**
 * Panel contextual por categoría: bottom sheet con las herramientas del tipo de
 * registro actual. Presentación pura (sin lógica de negocio): el dispatch por
 * `id`/`kind` lo hace la pantalla que lo abre (ver `app/property/[id].tsx`).
 *
 * Sin dependencias nativas nuevas: usa `Modal` de React Native + safe-area.
 */
export function CategoryContextSheet({
  visible,
  title,
  tools,
  busyToolId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  tools: ToolDef[];
  /** Id de la herramienta en curso (muestra spinner en su fila). */
  busyToolId?: string | null;
  onClose: () => void;
  onSelect: (tool: ToolDef) => void;
}) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: th.surface, borderColor: th.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: th.border }]} />
        <Text style={[styles.title, { color: th.text }]}>{title}</Text>

        {tools.map((tool) => {
          const busy = busyToolId === tool.id;
          const active = tool.enabled && !busy;
          return (
            <Pressable
              key={tool.id}
              onPress={() => active && onSelect(tool)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: th.border },
                pressed && active && { backgroundColor: th.imagePlaceholder },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: th.primarySoft }]}>
                <Ionicons name={tool.icon} size={18} color={tool.enabled ? th.primary : th.textSubtle} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: tool.enabled ? th.text : th.textSubtle }]}>
                  {t(tool.labelKey)}
                </Text>
                {(tool.hintKey || busy) && (
                  <Text style={[styles.rowHint, { color: th.textSubtle }]} numberOfLines={1}>
                    {busy ? t("tools.panel.updating") : tool.hintKey ? t(tool.hintKey) : null}
                  </Text>
                )}
              </View>
              {busy ? (
                <ActivityIndicator size="small" color={th.primary} />
              ) : (
                <Ionicons
                  name={tool.enabled ? "chevron-forward" : "lock-closed-outline"}
                  size={16}
                  color={th.textSubtle}
                />
              )}
            </Pressable>
          );
        })}
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
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: fonts.bodyMedium },
  rowHint: { fontSize: 12, marginTop: 1 },
});
