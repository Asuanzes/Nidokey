import { Link } from "expo-router";
import { fonts } from "@/lib/fonts";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

export default function ModalScreen() {
  const { th } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: th.bg }]}>
      <Text style={[styles.title, { color: th.text }]}>Nidokey</Text>
      <Link href="/" dismissTo style={styles.link}>
        <Text style={{ color: th.primary }}>Volver al inicio</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  title: { fontSize: 18, fontFamily: fonts.bodySemibold },
  link: { marginTop: 15, paddingVertical: 15 },
});
