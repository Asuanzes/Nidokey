import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

// expo-camera es un MÓDULO NATIVO. Si la app no se ha recompilado tras añadirlo,
// importarlo lanza "Cannot find native module 'ExpoCamera'" — y como expo-router
// evalúa TODAS las rutas al montar el Stack, eso tumbaría la app entera (pantalla
// negra). Por eso lo cargamos a prueba de fallos: si el nativo no está, la pantalla
// muestra un aviso y el resto de la app sigue funcionando.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CameraView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useCameraPermissions: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  /* módulo nativo ausente (app sin recompilar) → CameraView queda null */
}

/**
 * Escáner de código de barras (ISBN) para añadir libros físicos. Lee el EAN-13 del
 * libro, lo envía a POST /api/books/import-by-isbn (resuelve metadatos + persiste) y,
 * tras cada alta correcta, PREGUNTA: «Seguir escaneando» o «Ver ficha». Requiere
 * expo-camera (módulo nativo → la app debe estar recompilada).
 */
const ISBN13 = /^97[89]\d{10}$/;

type ScanState =
  | { kind: "scanning" }
  | { kind: "importing"; isbn: string }
  | { kind: "added"; id: string; title: string; cover: string | null }
  | { kind: "notfound"; isbn: string }
  | { kind: "error"; isbn: string; serviceDown?: boolean };

type ImportResponse = {
  record: { id: string; title: string; imageUrl: string | null };
  status: string;
};

export default function ScanBookScreen() {
  // Si el módulo nativo de cámara no está (app sin recompilar tras añadir
  // expo-camera) → aviso, sin montar la cámara ni sus hooks.
  if (!CameraView || !useCameraPermissions) return <CameraUnavailable />;
  return <Scanner />;
}

function Scanner() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: "scanning" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const lastIsbn = useRef<string | null>(null);

  async function importIsbn(isbn: string) {
    const clean = isbn.replace(/[^0-9Xx]/g, "");
    setState({ kind: "importing", isbn: clean });
    try {
      const res = await api<ImportResponse>("/api/books/import-by-isbn", {
        method: "POST",
        body: JSON.stringify({ isbn: clean }),
      });
      setState({ kind: "added", id: res.record.id, title: res.record.title, cover: res.record.imageUrl });
    } catch (e) {
      const code = e instanceof ApiError ? (e.body as { code?: string } | null)?.code : null;
      if (code === "BOOK_NOT_FOUND") setState({ kind: "notfound", isbn: clean });
      else if (code === "INVALID_ISBN") resume(); // no era un libro → seguir escaneando
      // METADATA_LOOKUP_FAILED = proveedores caídos/sin cuota → mensaje honesto
      // "servicio no disponible" (reintentable), no "error de conexión".
      else setState({ kind: "error", isbn: clean, serviceDown: code === "METADATA_LOOKUP_FAILED" });
    }
  }

  function onScan({ data }: { data: string }) {
    if (state.kind !== "scanning") return;
    const isbn = data.replace(/[^0-9Xx]/g, "");
    if (!ISBN13.test(isbn)) return; // no es un EAN-13 de libro (978/979) → ignorar
    if (isbn === lastIsbn.current) return;
    lastIsbn.current = isbn;
    void importIsbn(isbn);
  }

  function resume() {
    lastIsbn.current = null;
    setManualOpen(false);
    setManualIsbn("");
    setState({ kind: "scanning" });
  }

  function submitManual() {
    const clean = manualIsbn.replace(/[^0-9Xx]/g, "");
    if (clean.length < 10) return;
    setManualOpen(false);
    void importIsbn(clean);
  }

  // Permiso aún cargando / denegado → pantalla de permiso (+ entrada manual).
  if (!permission) return <View style={[styles.fill, { backgroundColor: th.bg }]} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: th.bg, padding: 24, gap: 14 }]}>
        <Ionicons name="camera-outline" size={40} color={th.textMuted} />
        <Text style={[styles.permTitle, { color: th.text }]}>{t("scan.permission_title")}</Text>
        <Text style={[styles.permText, { color: th.textSubtle }]}>
          {t("scan.permission_body")}
        </Text>
        <Button label={t("scan.permission_btn")} icon="camera-outline" onPress={requestPermission} />
        <Pressable onPress={() => setManualOpen((v) => !v)} hitSlop={8}>
          <Text style={[styles.link, { color: th.primary }]}>{t("scan.manual_link")}</Text>
        </Pressable>
        {manualOpen ? (
          <ManualBar
            th={th}
            value={manualIsbn}
            onChange={setManualIsbn}
            onSubmit={submitManual}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        active={state.kind === "scanning"}
        // En iOS el autofocus viene en "off" por defecto → el código sale borroso y
        // no lee bien (iPhone 14). Lo forzamos a "on" (continuo). En Android no estorba.
        autofocus="on"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "upc_a"] }}
        onBarcodeScanned={state.kind === "scanning" ? onScan : undefined}
      />

      {/* Guía visual */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Text style={styles.hint}>{t("scan.frame_hint")}</Text>
      </View>

      {/* Botón de entrada manual (solo mientras escanea) */}
      {state.kind === "scanning" ? (
        <Pressable style={styles.manualBtn} onPress={() => setManualOpen((v) => !v)} hitSlop={8}>
          <Ionicons name="keypad-outline" size={16} color="#fff" />
          <Text style={styles.manualBtnText}>{t("scan.manual_link")}</Text>
        </Pressable>
      ) : null}

      {/* Tarjeta de estado (abajo) */}
      {state.kind !== "scanning" ? (
        <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
          {state.kind === "importing" ? (
            <View style={styles.row}>
              <ActivityIndicator color={th.primary} />
              <Text style={[styles.cardText, { color: th.text }]}>{t("scan.searching")}</Text>
            </View>
          ) : state.kind === "added" ? (
            <>
              <View style={styles.row}>
                {state.cover ? (
                  <Image source={{ uri: state.cover }} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={[styles.cover, { backgroundColor: th.imagePlaceholder }]} />
                )}
                <View style={styles.rowText}>
                  <Text style={[styles.added, { color: th.primary }]}>{t("scan.added")}</Text>
                  <Text style={[styles.cardText, { color: th.text }]} numberOfLines={2}>
                    {state.title}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <View style={styles.flex1}>
                  <Button label={t("scan.keep_scanning")} variant="secondary" icon="scan-outline" onPress={resume} />
                </View>
                <View style={styles.flex1}>
                  <Button label={t("scan.view_record")} icon="arrow-forward" onPress={() => router.replace(`/book/${state.id}` as never)} />
                </View>
              </View>
            </>
          ) : state.kind === "notfound" ? (
            <>
              <Text style={[styles.cardText, { color: th.text }]}>
                {t("scan.notfound")}
              </Text>
              <View style={styles.actions}>
                <View style={styles.flex1}>
                  <Button label={t("scan.keep_scanning")} variant="secondary" icon="scan-outline" onPress={resume} />
                </View>
                <View style={styles.flex1}>
                  <Button label={t("scan.add_manual")} icon="create-outline" onPress={() => router.back()} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.cardText, { color: th.text }]}>
                {state.kind === "error" && state.serviceDown
                  ? t("importar.err_book_service_down")
                  : t("scan.conn_error")}
              </Text>
              <View style={styles.actions}>
                <View style={styles.flex1}>
                  <Button label={t("common.cancel")} variant="secondary" onPress={resume} />
                </View>
                <View style={styles.flex1}>
                  <Button label={t("common.retry")} icon="refresh-outline" onPress={() => importIsbn(state.isbn)} />
                </View>
              </View>
            </>
          )}
        </View>
      ) : null}

      {manualOpen && state.kind === "scanning" ? (
        <ManualBar th={th} value={manualIsbn} onChange={setManualIsbn} onSubmit={submitManual} />
      ) : null}
    </View>
  );
}

type Th = ReturnType<typeof useTheme>["th"];

function ManualBar({
  th,
  value,
  onChange,
  onSubmit,
}: {
  th: Th;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.manualBar, { backgroundColor: th.surface, borderColor: th.border }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t("scan.isbn_placeholder")}
        placeholderTextColor={th.textSubtle}
        keyboardType="number-pad"
        autoFocus
        style={[styles.manualInput, { color: th.text, borderColor: th.border, backgroundColor: th.bg }]}
      />
      <Button label={t("common.search")} icon="search" onPress={onSubmit} fullWidth={false} disabled={value.replace(/[^0-9Xx]/g, "").length < 10} />
    </View>
  );
}

/** Aviso cuando expo-camera (nativo) no está en el build → no rompe la app. */
function CameraUnavailable() {
  const { th } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: th.bg, padding: 24, gap: 14 }]}>
      <Ionicons name="camera-outline" size={40} color={th.textMuted} />
      <Text style={[styles.permTitle, { color: th.text }]}>{t("scan.unavailable_title")}</Text>
      <Text style={[styles.permText, { color: th.textSubtle }]}>
        {t("scan.unavailable_body")}
      </Text>
      <Button label={t("common.go_back")} icon="arrow-back" onPress={() => router.back()} fullWidth={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  permTitle: { fontSize: 17, fontFamily: fonts.bodyBold, textAlign: "center" },
  permText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  link: { fontSize: 14, fontFamily: fonts.bodySemibold },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 16 },
  frame: {
    width: "78%",
    height: 150,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  hint: { color: "#fff", fontSize: 14, fontFamily: fonts.bodySemibold, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  manualBtn: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  manualBtnText: { color: "#fff", fontSize: 13, fontFamily: fonts.bodySemibold },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 2 },
  cover: { width: 44, height: 66, borderRadius: 6 },
  added: { fontSize: 13, fontFamily: fonts.bodyBold },
  cardText: { fontSize: 15, fontFamily: fonts.bodyMedium },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  flex1: { flex: 1 },
  manualBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  manualInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
