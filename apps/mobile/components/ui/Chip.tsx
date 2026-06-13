import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";

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
  /** Nodo a la izquierda en vez del icono Ionicons (p. ej. CategoryIcon). */
  leading?: ReactNode;
};

export function Chip({ label, selected = false, onPress, icon, color, leading }: Props) {
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
        !selected ? th.elevation.sm : null,
        {
          backgroundColor: selected ? accent : th.surfaceRaised,
          borderColor: selected ? accent : th.border,
          borderRadius: th.radii.pill,
          opacity: pressed ? 0.86 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      {leading ?? (icon ? <Ionicons name={icon} size={14} color={fg} /> : null)}
      <Text numberOfLines={1} style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontFamily: fonts.bodySemibold },
});
