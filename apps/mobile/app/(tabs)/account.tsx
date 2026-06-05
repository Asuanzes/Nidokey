import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/lib/auth-context";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { API_URL } from "@/lib/api";
import { Button, Chip, Screen, Section } from "@/components/ui";

const THEME_MODES: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Claro", icon: "sunny-outline" },
  { value: "dark", label: "Oscuro", icon: "moon-outline" },
  { value: "auto", label: "Automático", icon: "contrast-outline" },
];

export default function AccountScreen() {
  const { state, logout } = useAuth();
  const { th, themeMode, setThemeMode } = useTheme();
  if (state.kind !== "authed") return null;

  return (
    <Screen contentStyle={styles.content}>
      <Section>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: th.primarySoft }]}>
            <Text style={[styles.avatarText, { color: th.primary }]}>
              {state.user.email.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.email, { color: th.text }]}>{state.user.email}</Text>
          {state.user.name && (
            <Text style={[styles.name, { color: th.textMuted }]}>{state.user.name}</Text>
          )}
        </View>
      </Section>

      <Section label="Apariencia">
        <View style={styles.modeRow}>
          {THEME_MODES.map((m) => (
            <Chip
              key={m.value}
              label={m.label}
              icon={m.icon}
              selected={themeMode === m.value}
              onPress={() => setThemeMode(m.value)}
            />
          ))}
        </View>
      </Section>

      <Section label="Categorías">
        <Pressable style={styles.toggleRow} onPress={() => router.push("/category-settings")}>
          <Ionicons name="albums-outline" size={20} color={th.textMuted} />
          <Text style={[styles.toggleLabel, { color: th.text }]}>Gestionar categorías</Text>
          <Ionicons name="chevron-forward" size={18} color={th.textSubtle} />
        </Pressable>
      </Section>

      <Section label="Servidor">
        <Text style={[styles.code, { color: th.text }]}>{API_URL}</Text>
      </Section>

      <Button
        label="Cerrar sesión"
        icon="log-out-outline"
        variant="danger"
        onPress={logout}
        style={styles.logout}
      />

      <Text style={[styles.footer, { color: th.textSubtle }]}>Nidokey · v0.1.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  profile: { alignItems: "center", gap: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "600" },
  email: { fontSize: 15, fontWeight: "500" },
  name: { fontSize: 13 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { flex: 1, fontSize: 15 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  code: { fontSize: 12, fontFamily: "monospace" },
  logout: { marginTop: 4 },
  footer: { marginTop: "auto", textAlign: "center", fontSize: 11, paddingBottom: 16 },
});
