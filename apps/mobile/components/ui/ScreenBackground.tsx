import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
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

export function ScreenBackground({ category, color }: Props) {
  const { th, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const accent = color ?? (category ? categoryColor(category, dark) : th.primary);
  const h = Math.max(height, 640);
  const w = Math.max(width, 320);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const waveOneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, dark ? 0.28 : 0.24]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [26, 0]) },
      { translateX: interpolate(progress.value, [0, 1], [-18, 0]) },
    ],
  }));

  const waveTwoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, dark ? 0.18 : 0.16]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [42, 0]) },
      { translateX: interpolate(progress.value, [0, 1], [20, 0]) },
    ],
  }));

  const topWave =
    `M -32 ${Math.round(h * 0.19)} ` +
    `C ${Math.round(w * 0.18)} ${Math.round(h * 0.1)}, ${Math.round(w * 0.32)} ${Math.round(h * 0.29)}, ${Math.round(w * 0.54)} ${Math.round(h * 0.2)} ` +
    `S ${Math.round(w * 0.88)} ${Math.round(h * 0.12)}, ${w + 32} ${Math.round(h * 0.22)} ` +
    `L ${w + 32} ${Math.round(h * 0.34)} L -32 ${Math.round(h * 0.32)} Z`;

  const bottomWave =
    `M -32 ${Math.round(h * 0.76)} ` +
    `C ${Math.round(w * 0.12)} ${Math.round(h * 0.68)}, ${Math.round(w * 0.35)} ${Math.round(h * 0.86)}, ${Math.round(w * 0.58)} ${Math.round(h * 0.77)} ` +
    `S ${Math.round(w * 0.9)} ${Math.round(h * 0.7)}, ${w + 32} ${Math.round(h * 0.82)} ` +
    `L ${w + 32} ${h + 32} L -32 ${h + 32} Z`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: th.bg }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="screenBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={th.bgTop} stopOpacity="1" />
            <Stop offset="0.46" stopColor={th.bg} stopOpacity="1" />
            <Stop offset="1" stopColor={th.bgBottom} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill="url(#screenBg)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, waveOneStyle]}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={topWave} fill={accent} />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, waveTwoStyle]}>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={bottomWave} fill={accent} />
        </Svg>
      </Animated.View>
    </View>
  );
}
