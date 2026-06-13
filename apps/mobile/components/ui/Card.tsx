import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/lib/theme";

/**
 * Contenedor de superficie con radio/borde/padding consistentes.
 * Base visual para Section, RecordCard, etc.
 */
export function Card({ style, children, ...rest }: ViewProps) {
  const { th } = useTheme();
  return (
    <View
      style={[
        styles.card,
        th.elevation.sm,
        {
          backgroundColor: th.surfaceRaised,
          borderColor: th.border,
          borderRadius: th.radii.lg,
          padding: th.space.lg,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
