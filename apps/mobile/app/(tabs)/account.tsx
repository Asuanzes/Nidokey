import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { API_URL } from "@/lib/api";
import { Button, Screen, Section } from "@/components/ui";

export default function AccountScreen() {
  const { state, logout } = useAuth();
  const { th } = useTheme();
  if (state.kind !== "authed") return null;

  return (
    <Screen title="Cuenta" contentStyle={styles.content}>
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
  code: { fontSize: 12, fontFamily: "monospace" },
  logout: { marginTop: 4 },
  footer: { marginTop: "auto", textAlign: "center", fontSize: 11, paddingBottom: 16 },
});
