import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Chip } from "@/components/ui";
import { useAppStyle, type AppStyle } from "@/lib/app-style-context";

const STYLES: {
  value: AppStyle;
  labelKey: "account.style_vintage" | "account.style_2100";
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "vintage", labelKey: "account.style_vintage", icon: "library-outline" },
  { value: "2100", labelKey: "account.style_2100", icon: "sparkles-outline" },
];

export function StyleSelector() {
  const { appStyle, setAppStyle } = useAppStyle();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {STYLES.map((s) => (
        <Chip
          key={s.value}
          label={t(s.labelKey)}
          icon={s.icon}
          selected={appStyle === s.value}
          onPress={() => setAppStyle(s.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
