import { useCallback, useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useTheme } from "@/lib/theme";
import { categoryColor } from "@/lib/records/config";
import type { RecordType } from "@nidokey/shared";

type Props = {
  category?: RecordType;
  color?: string;
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(a: string, b: string, amount: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * amount,
    g: ca.g + (cb.g - ca.g) * amount,
    b: ca.b + (cb.b - ca.b) * amount,
  });
}

export function ScreenBackground({ category, color }: Props) {
  const { th, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const accent = color ?? (category ? categoryColor(category, dark) : th.primary);
  const warmNeutral = dark ? "#3A342D" : "#E9DDCB";
  const rampTop = mixHex(th.bgTop, accent, dark ? 0.16 : 0.07);
  const rampMid = mixHex(th.bg, warmNeutral, dark ? 0.18 : 0.2);
  const rampBottom = mixHex(th.bgBottom, accent, dark ? 0.13 : 0.06);
  const duneNear = mixHex(th.bgBottom, accent, dark ? 0.24 : 0.11);
  const duneMid = mixHex(th.bg, accent, dark ? 0.2 : 0.08);
  const duneFar = mixHex(th.bgTop, accent, dark ? 0.16 : 0.07);
  const contour = mixHex(accent, th.text, dark ? 0.26 : 0.36);
  const h = Math.max(height, 640);
  const w = Math.max(width, 320);
  const animationKey = `${category ?? "none"}-${color ?? "auto"}-${dark ? "dark" : "light"}`;

  const restartIntro = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  useEffect(() => {
    restartIntro();
  }, [animationKey, restartIntro]);

  useFocusEffect(
    useCallback(() => {
      restartIntro();
    }, [restartIntro])
  );

  const farDuneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, dark ? 0.28 : 0.42]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [24, 0]) },
      { translateX: interpolate(progress.value, [0, 1], [-18, 0]) },
    ],
  }));

  const midDuneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, dark ? 0.32 : 0.46]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [38, 0]) },
      { translateX: interpolate(progress.value, [0, 1], [20, 0]) },
    ],
  }));

  const nearDuneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, dark ? 0.36 : 0.5]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [52, 0]) },
      { translateX: interpolate(progress.value, [0, 1], [-10, 0]) },
    ],
  }));

  const farDune =
    `M -40 ${Math.round(h * 0.26)} ` +
    `C ${Math.round(w * 0.12)} ${Math.round(h * 0.18)}, ${Math.round(w * 0.28)} ${Math.round(h * 0.31)}, ${Math.round(w * 0.44)} ${Math.round(h * 0.24)} ` +
    `C ${Math.round(w * 0.62)} ${Math.round(h * 0.16)}, ${Math.round(w * 0.77)} ${Math.round(h * 0.29)}, ${w + 40} ${Math.round(h * 0.21)} ` +
    `L ${w + 40} ${Math.round(h * 0.44)} ` +
    `C ${Math.round(w * 0.68)} ${Math.round(h * 0.39)}, ${Math.round(w * 0.3)} ${Math.round(h * 0.46)}, -40 ${Math.round(h * 0.38)} Z`;

  const midDune =
    `M -40 ${Math.round(h * 0.54)} ` +
    `C ${Math.round(w * 0.16)} ${Math.round(h * 0.43)}, ${Math.round(w * 0.28)} ${Math.round(h * 0.62)}, ${Math.round(w * 0.5)} ${Math.round(h * 0.51)} ` +
    `C ${Math.round(w * 0.7)} ${Math.round(h * 0.41)}, ${Math.round(w * 0.84)} ${Math.round(h * 0.59)}, ${w + 40} ${Math.round(h * 0.48)} ` +
    `L ${w + 40} ${Math.round(h * 0.74)} ` +
    `C ${Math.round(w * 0.72)} ${Math.round(h * 0.68)}, ${Math.round(w * 0.28)} ${Math.round(h * 0.76)}, -40 ${Math.round(h * 0.66)} Z`;

  const nearDune =
    `M -40 ${Math.round(h * 0.78)} ` +
    `C ${Math.round(w * 0.1)} ${Math.round(h * 0.68)}, ${Math.round(w * 0.32)} ${Math.round(h * 0.88)}, ${Math.round(w * 0.54)} ${Math.round(h * 0.77)} ` +
    `C ${Math.round(w * 0.73)} ${Math.round(h * 0.68)}, ${Math.round(w * 0.9)} ${Math.round(h * 0.82)}, ${w + 40} ${Math.round(h * 0.74)} ` +
    `L ${w + 40} ${h + 40} L -40 ${h + 40} Z`;

  const contourOne =
    `M -24 ${Math.round(h * 0.35)} ` +
    `C ${Math.round(w * 0.18)} ${Math.round(h * 0.31)}, ${Math.round(w * 0.34)} ${Math.round(h * 0.42)}, ${Math.round(w * 0.54)} ${Math.round(h * 0.35)} ` +
    `C ${Math.round(w * 0.73)} ${Math.round(h * 0.29)}, ${Math.round(w * 0.84)} ${Math.round(h * 0.38)}, ${w + 24} ${Math.round(h * 0.34)}`;

  const contourTwo =
    `M -24 ${Math.round(h * 0.63)} ` +
    `C ${Math.round(w * 0.13)} ${Math.round(h * 0.57)}, ${Math.round(w * 0.3)} ${Math.round(h * 0.7)}, ${Math.round(w * 0.52)} ${Math.round(h * 0.62)} ` +
    `C ${Math.round(w * 0.72)} ${Math.round(h * 0.55)}, ${Math.round(w * 0.88)} ${Math.round(h * 0.67)}, ${w + 24} ${Math.round(h * 0.6)}`;

  const contourThree =
    `M -24 ${Math.round(h * 0.86)} ` +
    `C ${Math.round(w * 0.2)} ${Math.round(h * 0.8)}, ${Math.round(w * 0.37)} ${Math.round(h * 0.93)}, ${Math.round(w * 0.6)} ${Math.round(h * 0.84)} ` +
    `C ${Math.round(w * 0.78)} ${Math.round(h * 0.77)}, ${Math.round(w * 0.92)} ${Math.round(h * 0.88)}, ${w + 24} ${Math.round(h * 0.82)}`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: th.bg }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="screenBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={rampTop} stopOpacity="1" />
            <Stop offset="0.5" stopColor={rampMid} stopOpacity="1" />
            <Stop offset="1" stopColor={rampBottom} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill="url(#screenBg)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, farDuneStyle]}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={farDune} fill={duneFar} />
          <Path d={contourOne} fill="none" stroke={contour} strokeOpacity={dark ? 0.12 : 0.13} strokeWidth={1} />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, midDuneStyle]}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={midDune} fill={duneMid} />
          <Path d={contourTwo} fill="none" stroke={contour} strokeOpacity={dark ? 0.13 : 0.14} strokeWidth={1} />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, nearDuneStyle]}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={nearDune} fill={duneNear} />
          <Path d={contourThree} fill="none" stroke={contour} strokeOpacity={dark ? 0.15 : 0.16} strokeWidth={1} />
        </Svg>
      </Animated.View>
    </View>
  );
}
