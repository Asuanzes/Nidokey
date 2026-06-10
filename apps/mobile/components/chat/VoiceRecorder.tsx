import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import type { PickedAttachment } from "@/lib/chat/media";

/**
 * Grabadora de notas de voz del composer. ⚠️ Importa expo-audio ESTÁTICAMENTE:
 * este archivo solo debe cargarse vía require() perezoso tras comprobar
 * `audioModuleAvailable()` (ver app/chat/[id].tsx) — así una OTA sobre un
 * binario sin expo-audio no crashea. Graba al montar; enviar = stop + upload.
 */
export function VoiceRecorder({
  busy,
  onCancel,
  onSend,
}: {
  /** true mientras se sube la nota (deshabilita botones). */
  busy: boolean;
  onCancel: () => void;
  onSend: (file: PickedAttachment) => void;
}) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [failed, setFailed] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) {
        setFailed(true);
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
    })().catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (!stoppedRef.current) {
        stoppedRef.current = true;
        void recorder.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopAndSend() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    const durationMs = Math.round(state.durationMillis ?? 0);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || durationMs < 500) {
        onCancel(); // demasiado corto o sin fichero
        return;
      }
      // HIGH_QUALITY graba AAC en contenedor MPEG-4 (.m4a) en iOS y Android.
      onSend({ uri, mime: "audio/mp4", fileName: null, durationMs });
    } catch {
      onCancel();
    }
  }

  const secs = Math.floor((state.durationMillis ?? 0) / 1000);
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <View style={[styles.row, { backgroundColor: th.surface, borderTopColor: th.border }]}>
      <Pressable
        onPress={onCancel}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        style={styles.iconBtn}
      >
        <Ionicons name="trash-outline" size={20} color={th.dangerFg} />
      </Pressable>

      {failed ? (
        <Text style={[styles.status, { color: th.dangerFg }]}>{t("chat.voice_permission")}</Text>
      ) : (
        <View style={styles.statusWrap}>
          <View style={[styles.dot, { backgroundColor: th.dangerFg }]} />
          <Text style={[styles.status, { color: th.text }]}>
            {t("chat.recording")} · {timer}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => void stopAndSend()}
        disabled={busy || failed}
        accessibilityRole="button"
        accessibilityLabel={t("chat.send")}
        style={[styles.sendBtn, { backgroundColor: failed ? th.border : th.primary }]}
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 6 },
  statusWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { flex: 1, fontSize: 14, fontFamily: fonts.bodyMedium },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
