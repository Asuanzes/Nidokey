import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth-context";
import { API_URL } from "@/lib/api";

export default function AccountScreen() {
  const { state, logout } = useAuth();
  if (state.kind !== "authed") return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cuenta</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {state.user.email.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.email}>{state.user.email}</Text>
          {state.user.name && <Text style={styles.name}>{state.user.name}</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Servidor</Text>
        <Text style={styles.code}>{API_URL}</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>BuySell Asturias · v0.1.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF7", padding: 16 },
  header: { marginBottom: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  section: {
    backgroundColor: "#fff", borderRadius: 10, padding: 16, gap: 6,
    borderWidth: 1, borderColor: "#e5e5e5", marginBottom: 12,
  },
  profile: { alignItems: "center", gap: 8 },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#EAEFF6",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "600", color: "#3A5F8A" },
  email: { fontSize: 15, fontWeight: "500", color: "#1a1a1a" },
  name: { fontSize: 13, color: "#666" },
  sectionLabel: {
    fontSize: 11, fontWeight: "500", color: "#666",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  code: { fontSize: 12, color: "#1a1a1a", fontFamily: "monospace" },
  logoutBtn: {
    flexDirection: "row", gap: 8,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "#F6E5E5", backgroundColor: "#fff",
    marginTop: 8,
  },
  logoutText: { color: "#B91C1C", fontSize: 14, fontWeight: "500" },
  footer: {
    marginTop: "auto", textAlign: "center", fontSize: 11, color: "#999", paddingBottom: 16,
  },
});
