import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reproductor de nota de voz dentro de la burbuja. ⚠️ Importa expo-audio
 * ESTÁTICAMENTE: cargar solo vía require() perezoso tras `audioModuleAvailable()`
 * (ver app/chat/[id].tsx) para no crashear binarios sin el módulo.
 */
export function AudioBubble({ url, durationMs }: { url: string; durationMs: number | null }) {
  const { th } = useTheme();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const total = status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000;
  const label = status.playing || status.currentTime > 0 ? `${fmt(status.currentTime)} / ${fmt(total)}` : fmt(total);

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (total > 0 && status.currentTime >= total - 0.1)) {
      player.seekTo(0);
    }
    player.play();
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        style={[styles.playBtn, { backgroundColor: th.primary }]}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={16} color="#fff" />
      </Pressable>
      <Ionicons name="mic-outline" size={16} color={th.textMuted} />
      <Text style={[styles.time, { color: th.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, minWidth: 150 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  time: { fontSize: 12, fontFamily: fonts.bodyMedium },
});
