import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";

/**
 * Pill seleccionable. Pensado para los filtros por tipo de registro
 * (RECORD_TYPE_CONFIG) en la futura lista unificada de records.
 *
 * `color` permite teñir el chip con el color del tipo (property, crypto…).
 */
type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Color de acento del tipo de registro; por defecto el primary del tema. */
  color?: string;
};

export function Chip({ label, selected = false, onPress, icon, color }: Props) {
  const { th } = useTheme();
  const accent = color ?? th.primary;
  const fg = selected ? th.primaryFg : th.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : th.surface,
          borderColor: selected ? accent : th.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={fg} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "500" },
});
