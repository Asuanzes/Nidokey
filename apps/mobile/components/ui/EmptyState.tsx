import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button } from "./Button";

/**
 * Estado vacío reutilizable: icono + título + descripción + acción opcional.
 * Sustituye los "empty views" inline distintos de cada pantalla.
 */
type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "file-tray-outline",
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  const { th } = useTheme();
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconWrap,
          th.elevation.sm,
          { backgroundColor: th.surfaceRaised, borderColor: th.border },
        ]}
      >
        <Ionicons name={icon} size={34} color={th.accent} />
      </View>
      <Text style={[styles.title, { color: th.text }]}>{title}</Text>
      {description && (
        <Text style={[styles.desc, { color: th.textMuted }]}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: 34, gap: 10 },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: { fontSize: 17, lineHeight: 22, fontFamily: fonts.heading, marginTop: 2, textAlign: "center" },
  desc: { fontSize: 13, textAlign: "center", lineHeight: 19, fontFamily: fonts.body, maxWidth: 280 },
});
