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

import { useTheme } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";
import { WebViewImporter, type ExtractedPayload } from "@/components/WebViewImporter";

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

type ImportResult = {
  created: boolean;
  priceChanged: boolean;
  propertyId: string;
  listingId: string;
  newPrice: number | null;
};

type Status =
  | "idle"
  | "extracting"   // WebView cargando y extrayendo datos
  | "sending"      // enviando a la API
  | "ok"
  | "error";

export default function ImportarScreen() {
  const { th } = useTheme();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleIncomingUrl = useCallback((u: string) => {
    if (isPortalUrl(u)) {
      setUrl(u);
      setStatus("idle");
      setResult(null);
      setErrorMsg(null);
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((u) => { if (u) handleIncomingUrl(u); });
    const sub = Linking.addEventListener("url", ({ url: u }) => handleIncomingUrl(u));
    return () => sub.remove();
  }, [handleIncomingUrl]);

  function startImport() {
    const trimmed = url.trim();
    if (!trimmed || status === "extracting" || status === "sending") return;
    setStatus("extracting");
    setResult(null);
    setErrorMsg(null);
  }

  async function handleExtracted(data: ExtractedPayload) {
    setStatus("sending");
    try {
      const res = await api<ImportResult>("/api/listings/import", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setResult(res);
      setStatus("ok");
    } catch (e) {
      const msg =
        e instanceof ApiError && e.body && typeof e.body === "object"
          ? ((e.body as { message?: string }).message ?? e.message)
          : e instanceof Error
          ? e.message
          : "Error al guardar el inmueble";
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  function handleWebViewError(reason: string) {
    setErrorMsg(reason || "No se pudo extraer datos del anuncio");
    setStatus("error");
  }

  function handleCancel() {
    setStatus("idle");
  }

  const isExtracting = status === "extracting";
  const isSending = status === "sending";
  const isBusy = isExtracting || isSending;
  const canImport = url.trim().length > 10 && !isBusy;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: th.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: th.text }]}>Importar</Text>
      </View>

      <View style={styles.content}>
        <TextInput
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setStatus("idle");
            setResult(null);
            setErrorMsg(null);
          }}
          placeholder="https://www.idealista.com/…"
          placeholderTextColor={th.textSubtle}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
          editable={!isBusy}
        />

        <Pressable
          style={[styles.btn, { backgroundColor: canImport ? th.accent : th.border }]}
          onPress={startImport}
          disabled={!canImport}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Importar</Text>
          )}
        </Pressable>

        {isExtracting && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.infoText, { color: th.textMuted }]}>
              🌐 Cargando el anuncio en segundo plano…
            </Text>
            <Text style={[styles.infoSub, { color: th.textSubtle }]}>
              Si aparece una verificación la verás automáticamente.
            </Text>
          </View>
        )}

        {isSending && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.infoText, { color: th.textMuted }]}>
              ☁️ Guardando en tu catálogo…
            </Text>
          </View>
        )}

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

        {status === "error" && errorMsg && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.errorText, { color: th.dangerFg }]}>{errorMsg}</Text>
            <Pressable onPress={() => setStatus("idle")}>
              <Text style={[styles.link, { color: th.primary }]}>Intentar de nuevo</Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.hint, { color: th.textSubtle }]}>
          {"Compatible con todos los portales: Idealista, Fotocasa, Pisos.com, Habitaclia, Milanuncios, Yaencontre, ThinkSPAIN, Indomio"}
        </Text>
      </View>

      {/* WebView montado en background cuando está extrayendo */}
      {isExtracting && (
        <WebViewImporter
          url={url.trim()}
          onExtracted={handleExtracted}
          onError={handleWebViewError}
          onCancel={handleCancel}
        />
      )}
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
  infoText: { fontSize: 14, fontWeight: "500" },
  infoSub: { fontSize: 12, lineHeight: 16 },
  resultText: { fontSize: 14, fontWeight: "500" },
  errorText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  hint: {
    fontSize: 12, lineHeight: 18,
    marginTop: "auto", textAlign: "center", paddingBottom: 8,
  },
});
