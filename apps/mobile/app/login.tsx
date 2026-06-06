import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui";

type Phase = "email" | "code";

export default function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Lógica de auth: SIN CAMBIOS (zona crítica) ──────────────────────────
  async function handleEmail() {
    if (!email.includes("@") || loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestOtp(email.trim().toLowerCase());
      setPhase("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.error_network"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCode() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(email.trim().toLowerCase(), code);
      // useAuth cambiará el estado y el root layout redirigirá a tabs
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.error_code"));
    } finally {
      setLoading(false);
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.brand}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🔑</Text>
          </View>
          <Text style={styles.title}>Nidokey</Text>
        </View>

        <View style={styles.card}>
          {phase === "email" ? (
            <>
              <Text style={styles.heading}>{t("login.heading")}</Text>
              <Text style={styles.sub}>{t("login.sub")}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("login.email_placeholder")}
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                editable={!loading}
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t("login.send_code")}
                onPress={handleEmail}
                loading={loading}
                disabled={!email.includes("@")}
                style={styles.cta}
              />
            </>
          ) : (
            <>
              <Text style={styles.heading}>{t("login.code_heading")}</Text>
              <Text style={styles.sub}>{t("login.code_sub", { email })}</Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("login.code_placeholder")}
                placeholderTextColor="#999"
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                editable={!loading}
                style={[styles.input, styles.codeInput]}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t("login.enter")}
                onPress={handleCode}
                loading={loading}
                disabled={code.length !== 6}
                style={styles.cta}
              />
              <Button
                label={t("login.change_email")}
                variant="ghost"
                size="sm"
                onPress={() => {
                  setPhase("email");
                  setCode("");
                  setError(null);
                }}
              />
            </>
          )}
        </View>

        <Text style={styles.footer}>{t("login.footer")}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF7" },
  flex: { flex: 1, padding: 24, justifyContent: "center" },
  brand: { alignItems: "center", gap: 8, marginBottom: 32 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#EAEFF6",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    gap: 12,
  },
  heading: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },
  sub: { fontSize: 13, color: "#666", marginBottom: 8 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#1a1a1a",
    backgroundColor: "#FAFAF7",
  },
  codeInput: {
    fontSize: 24,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    letterSpacing: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  cta: { marginTop: 4 },
  error: { fontSize: 12, color: "#B91C1C" },
  footer: { fontSize: 11, color: "#888", textAlign: "center", marginTop: 24 },
});
