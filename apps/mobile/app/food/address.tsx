import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card, Screen } from "@/components/ui";

const SPAIN_CENTER = { lat: 40.4168, lng: -3.7038 };

type FoodAddress = {
  id: string;
  label: string;
  line: string;
  city: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type PlaceDetails = {
  lat: number;
  lng: number;
  formattedAddress: string;
  name: string;
};

function cityFromAddress(address: string, fallback: string): string {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-2) ?? parts.at(-1) ?? fallback;
}

export default function FoodAddressScreen() {
  const { th } = useTheme();
  const q = useQuery(() => api<{ addresses: FoodAddress[] }>("/api/food/addresses"), []);
  const [label, setLabel] = useState("Casa");
  const [line, setLine] = useState("");
  const [city, setCity] = useState("Oviedo");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionToken = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, []);
  const bias = useMemo(() => {
    const first = q.data?.addresses?.[0];
    return first ? { lat: first.latitude, lng: first.longitude } : SPAIN_CENTER;
  }, [q.data]);

  useEffect(() => {
    const input = line.trim();
    if (selectedCoords || input.length < 2) {
      setSuggestions([]);
      setAutocompleteLoading(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setAutocompleteLoading(true);
      const qs = new URLSearchParams({
        input,
        lat: String(bias.lat),
        lng: String(bias.lng),
        sessionToken,
      });
      api<{ suggestions: PlaceSuggestion[] }>(`/api/food/places/autocomplete?${qs.toString()}`, {
        signal: controller.signal,
      })
        .then((res) => setSuggestions(res.suggestions))
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          setSuggestions([]);
        })
        .finally(() => setAutocompleteLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [bias.lat, bias.lng, line, selectedCoords, sessionToken]);

  function onLineChange(text: string) {
    setLine(text);
    setSelectedCoords(null);
  }

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setError(null);
    setDetailsLoadingId(suggestion.placeId);
    try {
      const qs = new URLSearchParams({ placeId: suggestion.placeId });
      const details = await api<PlaceDetails>(`/api/food/places/details?${qs.toString()}`);
      setLine(details.formattedAddress || suggestion.mainText);
      setCity(cityFromAddress(details.formattedAddress || suggestion.secondaryText, city));
      setSelectedCoords({ lat: details.lat, lng: details.lng });
      setSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo resolver la direccion");
    } finally {
      setDetailsLoadingId(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/food/addresses", {
        method: "POST",
        body: JSON.stringify({
          label,
          line,
          city,
          postalCode,
          notes,
          isDefault: true,
          ...(selectedCoords ? { lat: selectedCoords.lat, lng: selectedCoords.lng } : {}),
        }),
      });
      setLine("");
      setNotes("");
      setSelectedCoords(null);
      setSuggestions([]);
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title="Direccion de entrega">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.form}>
          <TextInput value={label} onChangeText={setLabel} placeholder="Etiqueta" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <View>
            <TextInput value={line} onChangeText={onLineChange} placeholder="Calle, numero, piso" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
            {(autocompleteLoading || suggestions.length > 0) && (
              <View style={[styles.suggestions, { borderColor: th.border, backgroundColor: th.surface }]}>
                {autocompleteLoading && suggestions.length === 0 ? <ActivityIndicator color={th.primary} /> : null}
                {suggestions.map((suggestion) => (
                  <Pressable key={suggestion.placeId} onPress={() => selectSuggestion(suggestion)} style={styles.suggestion}>
                    <Text style={[styles.suggestionMain, { color: th.text }]} numberOfLines={1}>{suggestion.mainText}</Text>
                    <Text style={[styles.suggestionSecondary, { color: th.textMuted }]} numberOfLines={1}>{suggestion.secondaryText}</Text>
                    {detailsLoadingId === suggestion.placeId ? <ActivityIndicator color={th.primary} size="small" /> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <TextInput value={city} onChangeText={setCity} placeholder="Ciudad" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={postalCode} onChangeText={setPostalCode} placeholder="Codigo postal" placeholderTextColor={th.textSubtle} keyboardType="numbers-and-punctuation" style={[styles.input, { color: th.text, borderColor: th.border }]} />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notas para el reparto" placeholderTextColor={th.textSubtle} style={[styles.input, { color: th.text, borderColor: th.border }]} />
          {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}
          <Button label="Guardar direccion" onPress={save} loading={saving} disabled={line.trim().length < 4 || city.trim().length < 2} />
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
  suggestions: { marginTop: 6, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  suggestion: { minHeight: 54, paddingHorizontal: 12, paddingVertical: 9, justifyContent: "center" },
  suggestionMain: { fontSize: 14, fontFamily: fonts.bodySemibold },
  suggestionSecondary: { fontSize: 12, marginTop: 2 },
  section: { fontSize: 12, fontFamily: fonts.bodyBold, textTransform: "uppercase" },
  title: { fontSize: 15, fontFamily: fonts.bodyBold },
  meta: { fontSize: 13, marginTop: 2 },
  error: { fontSize: 13 },
});
