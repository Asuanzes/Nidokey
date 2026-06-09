import { StyleSheet, Text, type ViewProps } from "react-native";
import { fonts } from "@/lib/fonts";

import { useTheme } from "@/lib/theme";
import { Card } from "./Card";

/**
 * Card con una etiqueta-cabecera en mayúsculas (patrón "SERVIDOR", "UBICACIÓN"…).
 * Unifica el bloque seccionado que varias pantallas reimplementaban a mano.
 */
type Props = ViewProps & { label?: string };

export function Section({ label, children, style, ...rest }: Props) {
  const { th } = useTheme();
  return (
    <Card style={style} {...rest}>
      {label && <Text style={[styles.label, { color: th.textMuted }]}>{label}</Text>}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: fonts.bodySemibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
});
