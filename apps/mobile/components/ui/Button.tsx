import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, type Theme } from "@/lib/theme";

/**
 * Botón unificado de Nidokey.
 *
 * Reemplaza los botones inline (TouchableOpacity/Pressable) que cada pantalla
 * redefinía con alturas/radios distintos. Una sola fuente de verdad para
 * tamaños, colores, estados (loading/disabled/pressed) e iconos.
 */

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Por defecto ocupa todo el ancho disponible (caso más común en móvil). */
  fullWidth?: boolean;
  style?: ViewStyle;
};

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 52 };
const FONT: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

function palette(th: Theme, variant: Variant): { bg: string; fg: string; border: string } {
  switch (variant) {
    case "primary":
      return { bg: th.primary, fg: th.primaryFg, border: "transparent" };
    case "secondary":
      return { bg: th.surface, fg: th.text, border: th.border };
    case "danger":
      return { bg: th.surface, fg: th.dangerFg, border: th.dangerSoft };
    case "ghost":
      return { bg: "transparent", fg: th.primary, border: "transparent" };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: Props) {
  const { th } = useTheme();
  const p = palette(th, variant);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: p.border === "transparent" ? 0 : 1,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={FONT[size] + 3} color={p.fg} />}
          <Text style={[styles.label, { color: p.fg, fontSize: FONT[size] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontWeight: "600" },
});
