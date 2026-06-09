import { Appearance, Text, View } from "react-native";

import { fonts } from "@/lib/fonts";
import { T, TD } from "@/lib/theme";

/**
 * Aviso para una surface DUPLICADA — se renderiza POR ENCIMA de expo-router (desde
 * el entry, `index.js`), así que NO monta un 2º NavigationContainer. Es un
 * componente PLANO (sin navegador, sin contexto): el tema se siembra de
 * `Appearance` porque arriba del root no hay ThemeProvider.
 *
 * Cuándo aparece: cuando una app NATIVA comparte con FLAG_ACTIVITY_NEW_TASK
 * (p. ej. la app de Amazon), Android monta una 2ª instancia del root; esta pantalla
 * la deja inerte para que la app real (la 1ª surface) no se corrompa.
 */
export function DuplicateRootNotice() {
  const dark = Appearance.getColorScheme() === "dark";
  const th = dark ? TD : T;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: th.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 3, color: th.textMuted }}>
        NIDOKEY
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, textAlign: "center", color: th.text }}>
        Abre Nidokey desde su icono para añadir libros.
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, textAlign: "center", color: th.textSubtle }}>
        Algunas apps (como la de Amazon) abren una ventana nueva al compartir. Copia el enlace o
        el título y búscalo dentro de Nidokey.
      </Text>
    </View>
  );
}
