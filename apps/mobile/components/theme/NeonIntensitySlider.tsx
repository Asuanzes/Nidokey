import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Chip } from "@/components/ui";
import { fonts } from "@/lib/fonts";
import { useTheme } from "@/lib/theme";
import { useNeon } from "@/lib/neon-context";

const LEVELS = [
  { value: 0.25, labelKey: "theme.intensity_low" },
  { value: 0.6, labelKey: "theme.intensity_medium" },
  { value: 0.8, labelKey: "theme.intensity_high" },
  { value: 1, labelKey: "theme.intensity_max" },
] as const;

export function NeonIntensitySlider() {
  const { th } = useTheme();
  const { intensity, setIntensity } = useNeon();
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {LEVELS.map((level) => (
          <Chip
            key={level.value}
            label={t(level.labelKey)}
            selected={Math.abs(intensity - level.value) < 0.06}
            onPress={() => setIntensity(level.value)}
          />
        ))}
      </View>
      <Text style={[styles.value, { color: th.textSubtle }]}>
        {t("theme.intensity_value", { value: Math.round(intensity * 100) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  value: { fontSize: 11, fontFamily: fonts.body },
});
