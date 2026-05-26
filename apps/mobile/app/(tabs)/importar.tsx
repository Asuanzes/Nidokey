import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";

export default function ImportarScreen() {
  const { th } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: th.text }]}>Importar</Text>
      </View>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: th.primarySoft }]}>
          <Ionicons name="download-outline" size={32} color={th.primary} />
        </View>
        <Text style={[styles.heading, { color: th.text }]}>Usa el userscript en web</Text>
        <Text style={[styles.sub, { color: th.textMuted }]}>
          Accede a la web desde tu ordenador, entra en /bookmarklet e instala el script para importar inmuebles desde los portales.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  heading: { fontSize: 18, fontWeight: "600" },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
