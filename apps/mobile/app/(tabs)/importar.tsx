import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";

const PORTAL_HOSTS = [
  "fotocasa.", "pisos.com", "habitaclia.", "thinkspain.", "indomio.",
  "idealista.", "milanuncios.", "yaencontre.",
];

function isPortalUrl(u: string): boolean {
  try {
    const hostname = new URL(u).hostname.toLowerCase();
    return PORTAL_HOSTS.some((h) => hostname.includes(h));
  } catch {
    return false;
  }
}

type ScrapeResult = {
  created: boolean;
  priceChanged: boolean;
  propertyId: string;
  listingId: string;
  newPrice: number | null;
};

type ApiErr = {
  error: string;
  portal?: string;
  message?: string;
};

type Status = "idle" | "loading" | "ok" | "error";

export default function ImportarScreen() {
  const { th } = useTheme();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [apiError, setApiError] = useState<ApiErr | null>(null);

  const handleIncomingUrl = useCallback((u: string) => {
    if (isPortalUrl(u)) {
      setUrl(u);
      setStatus("idle");
      setResult(null);
      setApiError(null);
    }
  }, []);

  useEffect(() => {
    // Cold start: app abierta via share intent de Android
    Linking.getInitialURL().then((u) => { if (u) handleIncomingUrl(u); });
    // Warm start: app ya abierta, llega URL via evento
    const sub = Linking.addEventListener("url", ({ url: u }) => handleIncomingUrl(u));
    return () => sub.remove();
  }, [handleIncomingUrl]);

  async function doImport() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setStatus("loading");
    setResult(null);
    setApiError(null);
    try {
      const data = await api<ScrapeResult>("/api/listings/scrape-url", {
        method: "POST",
        body: JSON.stringify({ url: trimmedUrl }),
      });
      setResult(data);
      setStatus("ok");
    } catch (e) {
      const err: ApiErr =
        e instanceof ApiError && e.body && typeof e.body === "object"
          ? (e.body as ApiErr)
          : { error: "network", message: e instanceof Error ? e.message : "Error de red" };
      setApiError(err);
      setStatus("error");
    }
  }

  const isManualOnly = apiError?.error === "manual_only";
  const canImport = url.trim().length > 10 && status !== "loading";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: th.text }]}>Importar</Text>
      </View>

      <View style={styles.content}>
        <TextInput
          value={url}
          onChangeText={(t) => { setUrl(t); setStatus("idle"); setResult(null); setApiError(null); }}
          placeholder="https://www.fotocasa.es/…"
          placeholderTextColor={th.textSubtle}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
          editable={status !== "loading"}
        />

        <Pressable
          style={[styles.btn, { backgroundColor: canImport ? th.accent : th.border }]}
          onPress={doImport}
          disabled={!canImport}
        >
          {status === "loading" ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Importar</Text>
          )}
        </Pressable>

        {status === "ok" && result && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.resultText, { color: th.text }]}>
              {result.created
                ? "✅ Inmueble creado"
                : result.priceChanged
                ? "💶 Precio actualizado"
                : "👌 Sin cambios — ya estaba en tu catálogo"}
            </Text>
          </View>
        )}

        {status === "error" && apiError && (
          isManualOnly ? (
            <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={styles.warningRow}>
                <Ionicons name="warning-outline" size={18} color={th.dangerFg} />
                <Text style={[styles.warningTitle, { color: th.text }]}>Portal no compatible</Text>
              </View>
              <Text style={[styles.body, { color: th.textMuted }]}>
                {apiError.portal} usa anti-bot que bloquea el scraping automático. Puedes abrir el anuncio en el navegador y añadirlo manualmente en la web.
              </Text>
              <Pressable onPress={() => Linking.openURL(url)}>
                <Text style={[styles.link, { color: th.primary }]}>Abrir en el navegador →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
              <Text style={[styles.errorText, { color: th.dangerFg }]}>
                {apiError.message ?? "Ha ocurrido un error. Inténtalo de nuevo."}
              </Text>
            </View>
          )
        )}

        <Text style={[styles.hint, { color: th.textSubtle }]}>
          {"Compatible: Fotocasa · Pisos.com · Habitaclia · ThinkSPAIN · Indomio\nNo compatible: Idealista · Milanuncios · Yaencontre"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  content: { flex: 1, padding: 16, gap: 12 },
  input: {
    height: 48, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 14,
  },
  btn: {
    height: 48, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
  resultText: { fontSize: 14, fontWeight: "500" },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  warningTitle: { fontSize: 14, fontWeight: "600" },
  body: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  errorText: { fontSize: 13 },
  hint: {
    fontSize: 12, lineHeight: 18,
    marginTop: "auto", textAlign: "center", paddingBottom: 8,
  },
});
