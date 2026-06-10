import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { normalizeUsername, usernameError } from "@nidokey/shared";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { checkUsername, getAccount, updateAccount } from "@/lib/chat/account";

type Status = "idle" | "checking" | "available" | "taken" | "invalid" | "saving" | "saved";

/**
 * Editor del alias público (@username) para la pantalla de Cuenta. Comprueba
 * disponibilidad con debounce y guarda en /api/account. El alias es opcional:
 * sin él, sigues localizable por email exacto.
 */
export function UsernameEditor() {
  const { th } = useTheme();
  const { t } = useTranslation();
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccount()
      .then((a) => {
        setCurrent(a.username);
        setValue(a.username ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const normalized = normalizeUsername(value);
  const changed = normalized !== (current ?? "");

  // Disponibilidad con debounce (solo si cambió y no está vacío).
  useEffect(() => {
    if (!changed || normalized === "") {
      setStatus("idle");
      return;
    }
    if (usernameError(normalized)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    const id = setTimeout(async () => {
      try {
        const r = await checkUsername(normalized);
        setStatus(r.available ? "available" : r.reason === "taken" ? "taken" : "invalid");
      } catch {
        setStatus("idle");
      }
    }, 350);
    return () => clearTimeout(id);
  }, [normalized, changed]);

  async function save() {
    setStatus("saving");
    try {
      const a = await updateAccount({ username: normalized || null });
      setCurrent(a.username);
      setValue(a.username ?? "");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setStatus(msg.includes("taken") ? "taken" : "invalid");
    }
  }

  if (loading) {
    return <ActivityIndicator color={th.primary} style={{ marginVertical: 12 }} />;
  }

  const canSave = changed && (normalized === "" || status === "available") && status !== "saving";
  const hint =
    status === "checking"
      ? t("account.username_checking")
      : status === "available"
        ? t("account.username_available")
        : status === "taken"
          ? t("account.username_taken")
          : status === "invalid"
            ? t("account.username_invalid")
            : status === "saved"
              ? t("account.username_saved")
              : t("account.username_hint");
  const hintColor =
    status === "available" || status === "saved"
      ? "#15803D"
      : status === "taken" || status === "invalid"
        ? th.dangerFg
        : th.textSubtle;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: th.textMuted }]}>{t("account.username_label")}</Text>
      <View style={styles.row}>
        <View style={[styles.inputBox, { backgroundColor: th.bg, borderColor: th.border }]}>
          <Text style={[styles.at, { color: th.textSubtle }]}>@</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={t("account.username_placeholder")}
            placeholderTextColor={th.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            style={[styles.input, { color: th.text }]}
          />
          {status === "checking" && <ActivityIndicator size="small" color={th.primary} />}
          {status === "available" && <Ionicons name="checkmark-circle" size={18} color="#15803D" />}
          {(status === "taken" || status === "invalid") && <Ionicons name="close-circle" size={18} color={th.dangerFg} />}
        </View>
        <Pressable
          onPress={save}
          disabled={!canSave}
          style={[styles.saveBtn, { backgroundColor: canSave ? th.primary : th.border }]}
        >
          <Text style={styles.saveText}>{t("common.save")}</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontFamily: fonts.bodySemibold },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  at: { fontSize: 15, fontFamily: fonts.bodySemibold },
  input: { flex: 1, fontSize: 15, padding: 0 },
  saveBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  saveText: { color: "#fff", fontSize: 13, fontFamily: fonts.bodySemibold },
  hint: { fontSize: 11 },
});
