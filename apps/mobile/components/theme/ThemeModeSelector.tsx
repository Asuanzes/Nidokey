import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Chip } from "@/components/ui";
import { useTheme, type ThemeMode } from "@/lib/theme";

const MODES: {
  value: ThemeMode;
  labelKey: "account.theme_light" | "account.theme_dark" | "account.theme_auto";
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", labelKey: "account.theme_light", icon: "sunny-outline" },
  { value: "dark", labelKey: "account.theme_dark", icon: "moon-outline" },
  { value: "auto", labelKey: "account.theme_auto", icon: "contrast-outline" },
];

export function ThemeModeSelector() {
  const { themeMode, setThemeMode } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {MODES.map((m) => (
        <Chip
          key={m.value}
          label={t(m.labelKey)}
          icon={m.icon}
          selected={themeMode === m.value}
          onPress={() => setThemeMode(m.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
