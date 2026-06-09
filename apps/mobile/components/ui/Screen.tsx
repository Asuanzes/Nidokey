import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";

/**
 * Contenedor raíz de pantalla: SafeAreaView + cabecera de título/subtítulo
 * opcional, con paddings consistentes. Evita que cada pantalla repita el
 * mismo bloque header + StyleSheet.
 */
type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Estilo extra para el área de contenido (debajo de la cabecera). */
  contentStyle?: ViewStyle;
  /** Acción opcional a la derecha del título (p. ej. un botón). */
  headerRight?: ReactNode;
};

export function Screen({ title, subtitle, children, contentStyle, headerRight }: Props) {
  const { th } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      {title && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: th.text }]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: th.textMuted }]}>{subtitle}</Text>
            )}
          </View>
          {headerRight}
        </View>
      )}
      <View style={[styles.content, !title && styles.contentNoHeader, contentStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontFamily: fonts.heading },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: fonts.body },
  content: { flex: 1 },
  /** Sin cabecera de título: pequeño respiro bajo la barra de estado. */
  contentNoHeader: { paddingTop: 8 },
});
