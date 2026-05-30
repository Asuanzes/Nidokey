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
      style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
});
