import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { API_URL } from "@/lib/api";

export default function AccountScreen() {
  const { state, logout } = useAuth();
  const { th } = useTheme();
  if (state.kind !== "authed") return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: th.text }]}>Cuenta</Text>
      </View>

      <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
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
      </View>

      <View style={[styles.section, { backgroundColor: th.surface, borderColor: th.border }]}>
        <Text style={[styles.sectionLabel, { color: th.textMuted }]}>Servidor</Text>
        <Text style={[styles.code, { color: th.text }]}>{API_URL}</Text>
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: th.surface, borderColor: th.dangerSoft }]}
        onPress={logout}
      >
        <Ionicons name="log-out-outline" size={18} color={th.dangerFg} />
        <Text style={[styles.logoutText, { color: th.dangerFg }]}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={[styles.footer, { color: th.textSubtle }]}>BuySell Asturias · v0.1.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  section: {
    borderRadius: 10, padding: 16, gap: 6,
    borderWidth: 1, marginBottom: 12,
  },
  profile: { alignItems: "center", gap: 8 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "600" },
  email: { fontSize: 15, fontWeight: "500" },
  name: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11, fontWeight: "500",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  code: { fontSize: 12, fontFamily: "monospace" },
  logoutBtn: {
    flexDirection: "row", gap: 8,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, marginTop: 8,
  },
  logoutText: { fontSize: 14, fontWeight: "500" },
  footer: {
    marginTop: "auto", textAlign: "center", fontSize: 11, paddingBottom: 16,
  },
});
