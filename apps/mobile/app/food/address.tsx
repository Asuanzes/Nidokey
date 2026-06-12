import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card, Screen } from "@/components/ui";

type FoodAddress = { id: string; label: string; line: string; city: string; postalCode: string | null; isDefault: boolean };

export default function FoodAddressScreen() {
  const { th } = useTheme();
  const q = useQuery(() => api<{ addresses: FoodAddress[] }>("/api/food/addresses"), []);
  const [label, setLabel] = useState("Casa");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("Oviedo");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/food/addresses", {
        method: "POST",
        body: JSON.stringify({ label, line, city, postalCode, notes, isDefault: true }),
      });
      setLine("");
      setNotes("");
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Dirección de entrega">
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.form}>
          <TextInput value={label} onChangeText={setLabel} placeholder="Etiqueta" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={line} onChangeText={setLine} placeholder="Calle, número, piso" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={city} onChangeText={setCity} placeholder="Ciudad" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={postalCode} onChangeText={setPostalCode} placeholder="Código postal" placeholderTextColor={th.textSubtle} keyboardType="numbers-and-punctuation" style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notas para el reparto" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}
          <Button label="Guardar dirección" onPress={save} loading={saving} disabled={line.trim().length < 4 || city.trim().length < 2} />
        </Card>
        <Text style={[styles.section, { color: th.textMuted }]}>Guardadas</Text>
        {q.loading && !q.data ? <ActivityIndicator color={th.primary} /> : q.data?.addresses.map((a) => (
          <Card key={a.id}>
            <Text style={[styles.title, { color: th.text }]}>{a.label}{a.isDefault ? " · predeterminada" : ""}</Text>
            <Text style={[styles.meta, { color: th.textMuted }]}>{a.line}</Text>
            <Text style={[styles.meta, { color: th.textSubtle }]}>{[a.postalCode, a.city].filter(Boolean).join(" ")}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  form: { gap: 10 },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  section: { fontSize: 12, fontFamily: fonts.bodyBold, textTransform: "uppercase" },
  title: { fontSize: 15, fontFamily: fonts.bodyBold },
  meta: { fontSize: 13, marginTop: 2 },
  error: { fontSize: 13 },
});
