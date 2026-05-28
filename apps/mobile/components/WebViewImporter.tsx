import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

import { useTheme } from "@/lib/theme";
import { getExtractorScript } from "@/lib/portal-extractors";

export type ExtractedPayload = {
  url: string;
  portal?: string;
  title: string;
  price?: number | null;
  description?: string | null;
  rooms?: number | null;
  bathrooms?: number | null;
  builtArea?: number | null;
  usableArea?: number | null;
  floor?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images: string[];
  features?: string[];
};

type Props = {
  url: string;
  onExtracted: (data: ExtractedPayload) => void;
  onError: (reason: string) => void;
  onCancel: () => void;
};

type WebViewMsg =
  | { type: "extracted"; data: ExtractedPayload }
  | { type: "challenge" }
  | { type: "error"; reason: string };

export function WebViewImporter({ url, onExtracted, onError, onCancel }: Props) {
  const { th } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<WebView>(null);
  const [challenge, setChallenge] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as WebViewMsg;
      if (msg.type === "extracted") {
        setChallenge(false);
        onExtracted(msg.data);
      } else if (msg.type === "challenge") {
        setChallenge(true);
      } else if (msg.type === "error") {
        onError(msg.reason);
      }
    } catch {
      onError("Respuesta inesperada del WebView");
    }
  }

  function handleLoadEnd() {
    const script = getExtractorScript(url);
    ref.current?.injectJavaScript(script);
  }

  // Cuando no hay challenge, el WebView está fuera de pantalla (carga en background).
  // Cuando hay challenge, ocupa toda la pantalla para que el usuario interactúe.
  const containerStyle = challenge
    ? [StyleSheet.absoluteFillObject, styles.visible, { paddingTop: insets.top }]
    : styles.hidden;

  return (
    <View style={containerStyle}>
      {challenge && (
        <View style={[styles.bar, { backgroundColor: th.surface, borderBottomColor: th.border }]}>
          <Text style={[styles.barText, { color: th.text }]}>
            🔐 Resuelve la verificación para continuar
          </Text>
          <Pressable onPress={() => { setChallenge(false); onCancel(); }}>
            <Text style={[styles.cancel, { color: th.primary }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      {!challenge && loadProgress < 1 && (
        <ActivityIndicator
          style={styles.hiddenIndicator}
          size="small"
          color={th.primary}
        />
      )}

      <WebView
        ref={ref}
        source={{ uri: url }}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onLoadProgress={({ nativeEvent }) => setLoadProgress(nativeEvent.progress)}
        style={styles.webview}
        // Evitar que el WebView intercepte gestos de la pantalla principal cuando está oculto
        pointerEvents={challenge ? "auto" : "none"}
        javaScriptEnabled
        domStorageEnabled
        // User-Agent de Chrome móvil para evitar detección
        applicationNameForUserAgent="Chrome/131.0.0.0 Mobile Safari/537.36"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    top: -5000,
    left: 0,
    width: 1,
    height: 1,
    overflow: "hidden",
  },
  visible: {
    backgroundColor: "#fff",
    zIndex: 999,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  cancel: {
    fontSize: 13,
    fontWeight: "600",
    paddingLeft: 12,
  },
  webview: {
    flex: 1,
  },
  hiddenIndicator: {
    position: "absolute",
    top: -5100,
  },
});
