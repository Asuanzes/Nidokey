import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { Button } from "./Button";

/**
 * Modal de resultado/confirmación con el ESTILO de la app (sustituye a los
 * `Alert.alert` nativos, que rompen la identidad visual). Tarjeta centrada sobre
 * un velo, icono por tono (éxito/error/info), título, mensaje y botones.
 *
 * Pensado para: "✅ ¡Reserva realizada!", confirmaciones y errores. Para una
 * confirmación (sí/no) pasa dos acciones, la primera `primary`/`danger`.
 */

type Tone = "success" | "error" | "info";
type ModalAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "secondary";
};

type Props = {
  visible: boolean;
  tone?: Tone;
  /** Icono Ionicons; si se omite, uno por defecto según el tono. */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string | null;
  /** Línea de detalle destacada (p. ej. referencias de reserva). */
  detail?: string | null;
  actions: ModalAction[];
  /** Cierre por botón atrás / pulsar fuera (opcional). */
  onRequestClose?: () => void;
};

const SUCCESS = "#15803D";

function toneColor(tone: Tone, th: ReturnType<typeof useTheme>["th"]): string {
  if (tone === "success") return SUCCESS;
  if (tone === "error") return th.dangerFg;
  return th.accent;
}

function defaultIcon(tone: Tone): keyof typeof Ionicons.glyphMap {
  if (tone === "success") return "checkmark-circle";
  if (tone === "error") return "alert-circle";
  return "information-circle";
}

export function ResultModal({
  visible,
  tone = "success",
  icon,
  title,
  message,
  detail,
  actions,
  onRequestClose,
}: Props) {
  const { th } = useTheme();
  const color = toneColor(tone, th);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        {/* El card detiene la propagación: pulsar dentro no cierra. */}
        <Pressable style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: color + "1A" }]}>
            <Ionicons name={icon ?? defaultIcon(tone)} size={34} color={color} />
          </View>
          <Text style={[styles.title, { color: th.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: th.textMuted }]}>{message}</Text> : null}
          {detail ? (
            <View style={[styles.detailBox, { backgroundColor: th.bg, borderColor: th.border }]}>
              <Text style={[styles.detailText, { color: th.text }]}>{detail}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button
                key={a.label}
                label={a.label}
                variant={a.variant ?? "primary"}
                onPress={a.onPress}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,20,18,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: { width: 60, height: 60, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  detailBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "stretch" },
  detailText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 8, marginTop: 6 },
});
