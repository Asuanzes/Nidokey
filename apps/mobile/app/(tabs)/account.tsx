import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts } from "@/lib/fonts";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/lib/auth-context";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAppStyle, type AppStyle } from "@/lib/app-style-context";
import { Button, Chip, Screen, Section } from "@/components/ui";
import { LanguageSelector } from "@/components/LanguageSelector";
import { UsernameEditor } from "@/components/chat/UsernameEditor";
import { AccountAvatar } from "@/components/chat/AccountAvatar";

const THEME_MODES: {
  value: ThemeMode;
  labelKey: "account.theme_light" | "account.theme_dark" | "account.theme_auto";
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", labelKey: "account.theme_light", icon: "sunny-outline" },
  { value: "dark", labelKey: "account.theme_dark", icon: "moon-outline" },
  { value: "auto", labelKey: "account.theme_auto", icon: "contrast-outline" },
];

const APP_STYLES: {
  value: AppStyle;
  labelKey: "account.style_vintage" | "account.style_2100";
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "vintage", labelKey: "account.style_vintage", icon: "library-outline" },
  { value: "2100", labelKey: "account.style_2100", icon: "sparkles-outline" },
];

export default function AccountScreen() {
  const { state, logout } = useAuth();
  const { th, themeMode, setThemeMode } = useTheme();
  const { appStyle, setAppStyle } = useAppStyle();
  const { t } = useTranslation();
  if (state.kind !== "authed") return null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <Section>
        <AccountAvatar email={state.user.email} name={state.user.name} />
      </Section>

      <Section label={t("account.username_section")}>
        <UsernameEditor />
      </Section>

      <Section label={t("account.appearance")}>
        <View style={styles.modeRow}>
          {THEME_MODES.map((m) => (
            <Chip
              key={m.value}
              label={t(m.labelKey)}
              icon={m.icon}
              selected={themeMode === m.value}
              onPress={() => setThemeMode(m.value)}
            />
          ))}
        </View>
      </Section>

      <Section label={t("account.app_style")}>
        <View style={styles.modeRow}>
          {APP_STYLES.map((s) => (
            <Chip
              key={s.value}
              label={t(s.labelKey)}
              icon={s.icon}
              selected={appStyle === s.value}
              onPress={() => setAppStyle(s.value)}
            />
          ))}
        </View>
      </Section>

      <Section label={t("settings.language.title")}>
        <LanguageSelector />
      </Section>

      <Section label={t("account.categories")}>
        <Pressable style={styles.toggleRow} onPress={() => router.push("/category-settings")}>
          <Ionicons name="albums-outline" size={20} color={th.textMuted} />
          <Text style={[styles.toggleLabel, { color: th.text }]}>{t("account.manage_categories")}</Text>
          <Ionicons name="chevron-forward" size={18} color={th.textSubtle} />
        </Pressable>
      </Section>

      <Section label={t("account.privacy")}>
        <Pressable style={styles.toggleRow} onPress={() => router.push("/chat/blocked" as never)}>
          <Ionicons name="ban-outline" size={20} color={th.textMuted} />
          <Text style={[styles.toggleLabel, { color: th.text }]}>{t("account.blocked_users")}</Text>
          <Ionicons name="chevron-forward" size={18} color={th.textSubtle} />
        </Pressable>
      </Section>

      <Button
        label={t("account.logout")}
        icon="log-out-outline"
        variant="danger"
        onPress={logout}
        style={styles.logout}
      />

      <Text style={[styles.footer, { color: th.textSubtle }]}>{t("account.footer")}</Text>
      <Text style={[styles.credit, { color: th.textSubtle }]}>
        Iconos: Solar (CC BY 4.0) · game-icons.net (CC BY 3.0) · Material Design Icons (Apache 2.0) · Phosphor (MIT)
      </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, flexGrow: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { flex: 1, fontSize: 15 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  logout: { marginTop: 4 },
  footer: { marginTop: "auto", textAlign: "center", fontSize: 11 },
  credit: { textAlign: "center", fontSize: 9, lineHeight: 13, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 16 },
});
