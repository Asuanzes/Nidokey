import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

/**
 * Par de iconos "compartir" + "abrir enlace externo" con el color de marca
 * (th.primary), el mismo gesto visual que la barra de AssetDetail (cripto/
 * mercados) pero en versión compacta para incrustar inline en una ficha.
 *
 * `onOpen` es opcional: si el registro no tiene URL externa, se omite el segundo
 * icono y solo se muestra "compartir".
 */
export function ShareOpenActions({
  onShare,
  onOpen,
  openLabel = "Abrir enlace externo",
  style,
}: {
  onShare: () => void;
  onOpen?: () => void;
  openLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { th } = useTheme();
  return (
    <View style={[styles.group, style]}>
      <Pressable
        onPress={onShare}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Compartir"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: th.surface, borderColor: th.border },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="share-social-outline" size={22} color={th.primary} />
      </Pressable>
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: th.surface, borderColor: th.border },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="open-outline" size={22} color={th.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", gap: 8 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
