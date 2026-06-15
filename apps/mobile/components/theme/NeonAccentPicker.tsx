import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { fonts } from "@/lib/fonts";
import { useTheme } from "@/lib/theme";
import { useNeon } from "@/lib/neon-context";
import { NEON_ACCENTS, NEON_ACCENT_IDS, type NeonAccentId } from "@/lib/neon-accents";

type LabelKey = `theme.accent_${NeonAccentId}`;

export function NeonAccentPicker() {
  const { th, dark } = useTheme();
  const { accent, setAccent } = useNeon();
  const { t } = useTranslation();

  return (
    <View style={styles.grid}>
      {NEON_ACCENT_IDS.map((id) => {
        const active = accent === id;
        const color = NEON_ACCENTS[id][dark ? "dark" : "light"];
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setAccent(id)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? th.accentSoft : th.surfaceRaised,
                borderColor: active ? th.accent : th.border,
                opacity: pressed ? 0.86 : 1,
              },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={[styles.label, { color: active ? th.accent : th.text }]} numberOfLines={1}>
              {t(`theme.accent_${id}` as LabelKey)}
            </Text>
            {active ? <Ionicons name="checkmark-circle" size={18} color={th.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: {
    minWidth: "47%",
    flexGrow: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  label: { flex: 1, fontSize: 13, fontFamily: fonts.bodySemibold },
});
