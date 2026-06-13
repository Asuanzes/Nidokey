import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RecordType } from "@nidokey/shared";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { ScreenBackground } from "./ScreenBackground";

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
  /** Fondo decorativo opt-in: gradiente + oleaje suave de entrada. */
  background?: boolean;
  /** Categoria usada para tintar el oleaje. */
  backgroundCategory?: RecordType;
  /** Color manual para el oleaje cuando no venga de una categoria. */
  backgroundColor?: string;
};

export function Screen({
  title,
  subtitle,
  children,
  contentStyle,
  headerRight,
  background = false,
  backgroundCategory,
  backgroundColor,
}: Props) {
  const { th } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      {background && <ScreenBackground category={backgroundCategory} color={backgroundColor} />}
      {title && (
        <View
          style={[
            styles.header,
            { paddingHorizontal: th.space.lg, paddingTop: th.space.md, paddingBottom: th.space.sm },
          ]}
        >
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
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.headingBold },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 3, fontFamily: fonts.body },
  content: { flex: 1 },
  /** Sin cabecera de título: pequeño respiro bajo la barra de estado. */
  contentNoHeader: { paddingTop: 8 },
});
