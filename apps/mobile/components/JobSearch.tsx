import { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  searchSource,
  registerCandidate,
  type SourceCandidate,
} from "@/lib/data/records-repository";

/**
 * Buscador de empleos (Adzuna): el usuario busca por *puesto* + *ubicación*, el
 * servidor consulta Adzuna (claves seguras) y devuelve candidatos; el usuario
 * toca "Seguir" en la oferta que quiere y se registra en Empleos.
 */
function metaStr(m: Record<string, unknown> | null | undefined, k: string): string | null {
  return m && typeof m[k] === "string" ? (m[k] as string) : null;
}

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object") {
    return (e.body as { error?: string }).error ?? e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

export function JobSearch() {
  const { th } = useTheme();
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [results, setResults] = useState<SourceCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const inputStyle = [styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }];

  async function doSearch() {
    if (what.trim().length < 2 || loading) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchSource("job", what, where));
    } catch (e) {
      setError(errMsg(e, "Error de búsqueda"));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function follow(c: SourceCandidate) {
    const key = c.externalId ?? c.title;
    if (busyId) return;
    setBusyId(key);
    setError(null);
    try {
      await registerCandidate(c);
      setAdded((s) => new Set(s).add(key));
    } catch (e) {
      setError(errMsg(e, "No se pudo registrar"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={what}
        onChangeText={setWhat}
        placeholder="Puesto (ej. React developer)"
        placeholderTextColor={th.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={doSearch}
        editable={!loading}
        style={inputStyle}
      />
      <TextInput
        value={where}
        onChangeText={setWhere}
        placeholder="Ubicación (ej. Asturias) — opcional"
        placeholderTextColor={th.textSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={doSearch}
        editable={!loading}
        style={inputStyle}
      />
      <Button
        label="Buscar empleos"
        icon="search-outline"
        onPress={doSearch}
        loading={loading}
        disabled={what.trim().length < 2}
      />

      {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}

      <FlatList
        data={results ?? []}
        keyExtractor={(c) => c.externalId ?? c.title}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.hint, { color: th.textSubtle }]}>
              {results === null
                ? "Busca un puesto y, opcionalmente, una ubicación. Toca “Seguir” en la oferta que quieras rastrear."
                : "Sin resultados. Prueba otros términos."}
            </Text>
          ) : null
        }
        renderItem={({ item: c }) => {
          const key = c.externalId ?? c.title;
          const meta = c.meta;
          const company = metaStr(meta, "company");
          const location = metaStr(meta, "location");
          const salaryText = metaStr(meta, "salaryText");
          const footnote = metaStr(meta, "footnote");
          const isAdded = added.has(key);
          return (
            <Card style={styles.card}>
              <Text style={[styles.title, { color: th.text }]} numberOfLines={2}>{c.title}</Text>
              {(company || location) && (
                <Text style={[styles.sub, { color: th.textMuted }]} numberOfLines={1}>
                  {[company, location].filter(Boolean).join(" · ")}
                </Text>
              )}
              {salaryText && <Text style={[styles.salary, { color: th.accent }]}>{salaryText}</Text>}
              {footnote && (
                <Text style={[styles.foot, { color: th.textSubtle }]} numberOfLines={1}>{footnote}</Text>
              )}
              <Button
                label={isAdded ? "En Empleos" : "Seguir"}
                icon={isAdded ? "checkmark" : "add"}
                variant={isAdded ? "secondary" : "primary"}
                size="sm"
                fullWidth={false}
                onPress={() => follow(c)}
                loading={busyId === key}
                disabled={isAdded}
                style={styles.followBtn}
              />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 10 },
  input: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  error: { fontSize: 13 },
  list: { paddingTop: 4, paddingBottom: 24, gap: 10 },
  hint: { fontSize: 13, lineHeight: 19, paddingVertical: 16, paddingHorizontal: 4 },
  card: { gap: 4 },
  title: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12 },
  salary: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  foot: { fontSize: 11 },
  followBtn: { marginTop: 8 },
});
