import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

/**
 * Pantalla de carga: anillo de bolitas en bronce con estela de cometa (opacidad
 * creciente) que gira en continuo + el wordmark "Nidokey" debajo. Sin icono.
 * Hecho con el `Animated` nativo de RN (una sola interpolación de rotación,
 * useNativeDriver): cero dependencia de worklets en el arranque.
 *
 * El splash nativo pinta estas MISMAS bolitas estáticas (assets/images/
 * splash-dots.png, misma geometría) para que aparezcan en el frame 1 y, al
 * montar el JS, empiecen a girar sin salto.
 */
const SIZE = 56; // diámetro del anillo (tamaño original)
const DOT = 9; // tamaño de cada bolita
const N = 8; // número de bolitas

export function BrandLoading() {
  const { th } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const dots = useMemo(() => {
    const c = SIZE / 2;
    const r = c - DOT / 2 - 2;
    return Array.from({ length: N }, (_, i) => {
      const ang = (2 * Math.PI * i) / N - Math.PI / 2;
      return {
        left: c + r * Math.cos(ang) - DOT / 2,
        top: c + r * Math.sin(ang) - DOT / 2,
        opacity: 0.12 + (i / (N - 1)) * 0.88,
      };
    });
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: th.bg }]}>
      <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
        {dots.map((d, i) => (
          <View
            key={i}
            style={[styles.dot, { left: d.left, top: d.top, opacity: d.opacity, backgroundColor: th.accent }]}
          />
        ))}
      </Animated.View>
      <Text style={[styles.title, { color: th.textMuted }]}>Nidokey</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  ring: { width: SIZE, height: SIZE },
  dot: { position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2 },
  title: { fontSize: 13, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase" },
});
