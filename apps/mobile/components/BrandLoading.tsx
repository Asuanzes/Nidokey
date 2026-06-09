import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { RECORD_TYPES } from "@nidokey/shared";
import { categoryColor } from "@/lib/records/config";

/**
 * Pantalla de carga: anillo de 8 bolitas (una por categoría, con su color) que
 * gira en continuo + el wordmark "Nidokey" debajo. Sin icono.
 * Hecho con el `Animated` nativo de RN (una sola interpolación de rotación,
 * useNativeDriver): cero dependencia de worklets en el arranque.
 *
 * El splash nativo (expo-splash-screen) usa `splash-blank.png` (en blanco) sobre
 * el color de fondo del tema, sin bolitas; estas aparecen al montar el JS. El
 * `assets/images/splash-dots.png` del repo está sin usar (legacy).
 */
const SIZE = 56; // diámetro del anillo (tamaño original)
const DOT = 9; // tamaño de cada bolita
const N = 8; // número de bolitas

export function BrandLoading() {
  const { th, dark } = useTheme();
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
      };
    });
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: th.bg }]}>
      <Animated.View style={[styles.ring, { transform: [{ rotate }] }]}>
        {dots.map((d, i) => (
          <View
            key={i}
            style={[styles.dot, { left: d.left, top: d.top, backgroundColor: categoryColor(RECORD_TYPES[i % RECORD_TYPES.length], dark) }]}
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
  title: { fontSize: 13, fontFamily: fonts.bodyBold, letterSpacing: 3, textTransform: "uppercase", paddingHorizontal: 4 },
});
