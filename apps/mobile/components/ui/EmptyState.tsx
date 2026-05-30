import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
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
      <Ionicons name={icon} size={40} color={th.textSubtle} />
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
  wrap: { alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  title: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  desc: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
