import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";

type Phase = "email" | "code";

export default function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmail() {
    if (!email.includes("@") || loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestOtp(email.trim().toLowerCase());
      setPhase("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
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
      setError(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setLoading(false);
    }
  }

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
          <Text style={styles.title}>BuySell Asturias</Text>
        </View>

        <View style={styles.card}>
          {phase === "email" ? (
            <>
              <Text style={styles.heading}>Accede a tu cuenta</Text>
              <Text style={styles.sub}>Te enviaremos un código por email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                editable={!loading}
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                onPress={handleEmail}
                disabled={loading || !email.includes("@")}
                style={[styles.button, (loading || !email.includes("@")) && styles.buttonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Enviarme el código</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Código de 6 dígitos</Text>
              <Text style={styles.sub}>Enviado a {email}</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                editable={!loading}
                style={[styles.input, styles.codeInput]}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                onPress={handleCode}
                disabled={loading || code.length !== 6}
                style={[styles.button, (loading || code.length !== 6) && styles.buttonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Acceder</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setPhase("email");
                  setCode("");
                  setError(null);
                }}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>← Cambiar email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          Sin contraseñas. Cada acceso pide un código por email.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF7" },
  flex: { flex: 1, padding: 24, justifyContent: "center" },
  brand: { alignItems: "center", gap: 8, marginBottom: 32 },
  iconBox: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: "#EAEFF6",
    alignItems: "center", justifyContent: "center",
  },
  iconText: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: "#e5e5e5", gap: 12,
  },
  heading: { fontSize: 18, fontWeight: "600", color: "#1a1a1a" },
  sub: { fontSize: 13, color: "#666", marginBottom: 8 },
  input: {
    height: 44, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8,
    paddingHorizontal: 12, fontSize: 15, color: "#1a1a1a", backgroundColor: "#FAFAF7",
  },
  codeInput: {
    fontSize: 24, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    letterSpacing: 8, textAlign: "center", fontWeight: "600",
  },
  button: {
    height: 44, backgroundColor: "#3A5F8A", borderRadius: 8,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#FAFAF7", fontSize: 15, fontWeight: "500" },
  error: { fontSize: 12, color: "#B91C1C" },
  linkButton: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 13, color: "#3A5F8A" },
  footer: { fontSize: 11, color: "#888", textAlign: "center", marginTop: 24 },
});
