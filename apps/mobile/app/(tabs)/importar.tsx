import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View, Linking } from "react-native";
import ShareMenu, { type ShareData } from "react-native-share-menu";
import { router } from "expo-router";

import { useTheme } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";
import { WebViewImporter, type ExtractedPayload } from "@/components/WebViewImporter";
import { Button, Card, Screen } from "@/components/ui";

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

function extractUrl(data: ShareData): string | null {
  if (!data?.data) return null;
  const items = Array.isArray(data.data) ? data.data : [data.data];
  for (const item of items) {
    const text = typeof item === "string" ? item : item?.data ?? "";
    const match = text.match(/https?:\/\/[^\s]+/);
    if (match && isPortalUrl(match[0])) return match[0];
  }
  return null;
}

type ImportResult = {
  created: boolean;
  priceChanged: boolean;
  propertyId: string;
  listingId: string;
  newPrice: number | null;
};

type Status = "idle" | "extracting" | "sending" | "ok" | "error";

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

  const handleShare = useCallback(
    (data: ShareData | null) => {
      if (!data) return;
      const u = extractUrl(data);
      if (u) handleIncomingUrl(u);
    },
    [handleIncomingUrl]
  );

  useEffect(() => {
    Linking.getInitialURL().then((u) => { if (u) handleIncomingUrl(u); });
    const linkSub = Linking.addEventListener("url", ({ url: u }) => handleIncomingUrl(u));

    ShareMenu.getInitialShare(handleShare);
    const shareSub = ShareMenu.addNewShareListener(handleShare);

    return () => {
      linkSub.remove();
      shareSub.remove();
    };
  }, [handleIncomingUrl, handleShare]);

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
      setTimeout(() => {
        router.push(`/property/${res.propertyId}`);
      }, 800);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.body && typeof e.body === "object"
          ? ((e.body as { message?: string; error?: string }).error ??
             (e.body as { message?: string }).message ??
             e.message)
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

  const isExtracting = status === "extracting";
  const isSending = status === "sending";
  const isBusy = isExtracting || isSending;
  const canImport = url.trim().length > 10;

  return (
    <Screen contentStyle={styles.content}>
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

      <Button
        label="Importar"
        icon="arrow-down-circle-outline"
        onPress={startImport}
        loading={isBusy}
        disabled={!canImport}
      />

      {isExtracting && (
        <Card>
          <Text style={[styles.infoText, { color: th.textMuted }]}>
            🌐 Cargando el anuncio en segundo plano…
          </Text>
          <Text style={[styles.infoSub, { color: th.textSubtle }]}>
            Si aparece una verificación la verás automáticamente.
          </Text>
        </Card>
      )}

      {isSending && (
        <Card>
          <Text style={[styles.infoText, { color: th.textMuted }]}>
            ☁️ Guardando en tu catálogo…
          </Text>
        </Card>
      )}

      {status === "ok" && result && (
        <Card>
          <Text style={[styles.resultText, { color: th.text }]}>
            {result.created
              ? "✅ Inmueble creado"
              : result.priceChanged
              ? "💶 Precio actualizado"
              : "👌 Sin cambios — ya estaba en tu catálogo"}
          </Text>
        </Card>
      )}

      {status === "error" && errorMsg && (
        <Card>
          <Text style={[styles.errorText, { color: th.dangerFg }]}>{errorMsg}</Text>
          <Button
            label="Intentar de nuevo"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => setStatus("idle")}
            style={styles.retry}
          />
        </Card>
      )}

      <Card style={styles.hintBox}>
        <Text style={[styles.hintTitle, { color: th.textMuted }]}>Cómo importar</Text>
        <Text style={[styles.hintText, { color: th.textSubtle }]}>
          1. Abre un anuncio en Chrome{"\n"}
          2. Pulsa Compartir → Nidokey{"\n"}
          3. La URL aparecerá aquí automáticamente
        </Text>
      </Card>

      {isExtracting && (
        <WebViewImporter
          url={url.trim()}
          onExtracted={handleExtracted}
          onError={handleWebViewError}
          onCancel={() => setStatus("idle")}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  infoText: { fontSize: 14, fontWeight: "500" },
  infoSub: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  resultText: { fontSize: 14, fontWeight: "500" },
  errorText: { fontSize: 13 },
  retry: { marginTop: 6 },
  hintBox: { marginTop: "auto" },
  hintTitle: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  hintText: { fontSize: 12, lineHeight: 18 },
});
