import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useLanguage } from "@/lib/i18n/language-context";
import { LANGUAGES } from "@/lib/i18n/languages";

/**
 * Selector de idioma para Ajustes (Cuenta → Idioma). Lista los idiomas con
 * traducción disponible (`LANGUAGES`) + una opción "Automático (sistema)".
 * Cambio en caliente (react-i18next re-renderiza) y persistencia inmediata
 * (SecureStore, vía useLanguage). Accesible (role/label/selected).
 */
type Th = ReturnType<typeof useTheme>["th"];

export function LanguageSelector() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const { pref, language, setLanguage } = useLanguage();

  // Idioma efectivo cuando la preferencia es "auto" (para el subtítulo).
  const activeNative = LANGUAGES.find((l) => l.code === language)?.nameNative ?? "";

  return (
    <View style={styles.list}>
      <Row
        th={th}
        flag="🌐"
        title={t("settings.language.auto")}
        subtitle={activeNative}
        selected={pref === "auto"}
        onPress={() => setLanguage("auto")}
      />
      {LANGUAGES.map((l) => (
        <Row
          key={l.code}
          th={th}
          flag={l.flag}
          title={l.nameNative}
          subtitle={l.nameEnglish}
          selected={pref === l.code}
          badge={
            l.translationQuality === "automatic"
              ? t("settings.language.automatic")
              : l.translationQuality === "partial"
                ? t("settings.language.partial")
                : null
          }
          onPress={() => setLanguage(l.code)}
        />
      ))}
    </View>
  );
}

function Row({
  th,
  flag,
  title,
  subtitle,
  selected,
  badge,
  onPress,
}: {
  th: Th;
  flag: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  badge?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? th.accentSoft : th.surface,
          borderColor: selected ? th.accent : th.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.flag}>{flag}</Text>
      <View style={styles.flex}>
        <Text style={[styles.title, { color: selected ? th.accent : th.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: th.textSubtle }]}>{subtitle}</Text> : null}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: th.accentSoft }]}>
            <Text style={[styles.badgeText, { color: th.accent }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={th.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  flex: { flex: 1 },
  flag: { fontSize: 22 },
  title: { fontSize: 15, fontFamily: fonts.bodySemibold },
  subtitle: { fontSize: 12, marginTop: 1 },
  badge: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontFamily: fonts.bodySemibold },
});
