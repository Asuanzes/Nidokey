import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
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
      <Pressable style={[styles.backdrop, { backgroundColor: th.overlay }]} onPress={onRequestClose}>
        {/* El card detiene la propagación: pulsar dentro no cierra. */}
        <Pressable
          style={[
            styles.card,
            th.elevation.lg,
            { backgroundColor: th.surfaceRaised, borderColor: th.border, borderRadius: th.radii.xl },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.iconCircle, { backgroundColor: color + "1F", borderColor: color + "3A" }]}>
            <Ionicons name={icon ?? defaultIcon(tone)} size={34} color={color} />
          </View>
          <Text style={[styles.title, { color: th.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: th.textMuted }]}>{message}</Text> : null}
          {detail ? (
            <View style={[styles.detailBox, { backgroundColor: th.surfaceSoft, borderColor: th.border }]}>
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
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, lineHeight: 25, fontFamily: fonts.heading, textAlign: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center", fontFamily: fonts.body },
  detailBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignSelf: "stretch" },
  detailText: { fontSize: 13, fontFamily: fonts.bodySemibold, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 8, marginTop: 4 },
});
