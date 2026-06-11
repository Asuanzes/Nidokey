import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { WALLPAPERS, type WallpaperId } from "@/lib/chat/wallpapers";

/**
 * Selector de fondo del chat: grid de miniaturas + "Sin fondo" + toggle
 * "Aplicar a todos los chats". Tocar una miniatura aplica y cierra.
 * Mismo patrón visual (Modal bottom sheet) que ActionsSheet — sin deps nativas.
 */
export function WallpaperSheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: WallpaperId;
  onSelect: (id: WallpaperId, allChats: boolean) => void;
  onClose: () => void;
}) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [allChats, setAllChats] = useState(false);

  const tiles: { id: WallpaperId; label: string; source: ImageSourcePropType | null }[] = [
    ...WALLPAPERS.map((w) => ({ id: w.id, label: t(w.labelKey), source: w.source })),
    { id: "none", label: t("chat.bg_none"), source: null },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: th.surface, borderColor: th.border, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: th.border }]} />
        <Text style={[styles.title, { color: th.text }]}>{t("chat.bg_title")}</Text>

        <View style={styles.grid}>
          {tiles.map((tile) => {
            const selected = current === tile.id;
            return (
              <Pressable
                key={tile.id}
                onPress={() => onSelect(tile.id, allChats)}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                style={[
                  styles.tile,
                  { borderColor: selected ? th.primary : th.border, backgroundColor: th.bg },
                  selected && styles.tileSelected,
                ]}
              >
                {tile.source ? (
                  <Image source={tile.source} style={styles.tileImg} contentFit="cover" transition={100} />
                ) : (
                  <View style={styles.tileNone}>
                    <Ionicons name="ban-outline" size={22} color={th.textSubtle} />
                  </View>
                )}
                <Text style={[styles.tileLabel, { color: th.textMuted, backgroundColor: th.surface }]} numberOfLines={1}>
                  {tile.label}
                </Text>
                {selected && (
                  <View style={[styles.check, { backgroundColor: th.primary }]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setAllChats((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allChats }}
          style={styles.allRow}
        >
          <Ionicons
            name={allChats ? "checkbox" : "square-outline"}
            size={20}
            color={allChats ? th.primary : th.textSubtle}
          />
          <Text style={[styles.allLabel, { color: th.text }]}>{t("chat.bg_all_chats")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 14,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  title: { fontSize: 16, fontFamily: fonts.bodyBold, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47%",
    flexGrow: 1,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
  },
  tileSelected: { borderWidth: 2 },
  tileImg: { flex: 1 },
  tileNone: { flex: 1, alignItems: "center", justifyContent: "center" },
  tileLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    textAlign: "center",
    paddingVertical: 3,
    opacity: 0.92,
  },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  allRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 2 },
  allLabel: { fontSize: 14, fontFamily: fonts.bodyMedium },
});
