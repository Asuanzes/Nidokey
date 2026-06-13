import { StyleSheet, Text, View } from "react-native";

import { adsEnabled } from "@/lib/feature-flags";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";

/**
 * Hueco inerte para un banner publicitario.
 *
 * El rediseño "2100" reserva una franja entre el contenido principal de cada
 * categoría viable (inicio de registros, comida, lista de chats) para integrar
 * ads cuando estén cableados. Hasta entonces:
 *  - Si `adsEnabled === false` (default), el componente NO RENDERIZA NADA.
 *    Esto evita reservar espacio en pantalla sin razón y deja el bundler
 *    tree-shakear el componente en producción.
 *  - Si se activa el flag en dev, se pinta un cuadro de 56pt con la etiqueta
 *    "Espacio publicitario" para verificar el hueco sin proveedor real.
 *
 * Nada de tracking, nada de red. La integración con un proveedor llega en un
 * lote posterior con revisión de privacidad.
 */
export function AdBannerSlot() {
  const { th } = useTheme();
  if (!adsEnabled) return null;
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Espacio publicitario"
      style={[
        styles.slot,
        {
          backgroundColor: th.surfaceSoft,
          borderColor: th.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: th.textSubtle }]}>Espacio publicitario</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: 56,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.bodySemibold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
