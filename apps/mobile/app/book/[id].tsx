import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { type BaseRecord, type Book, metaField } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Ficha de un libro guardado. Lee el `Book` completo de `meta.book` (lo guarda
 * el backend al importar desde Google Books) y muestra portada, ficha y sinopsis.
 * Botón para abrir el libro en la web del proveedor (detailUrl).
 */
export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th } = useTheme();
  const [record, setRecord] = useState<BaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<BaseRecord>(`/api/records/${id}?type=book`);
        if (alive) setRecord(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ title: "Libro" }} />
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }

  const book = record ? metaField<Book | null>(record, "book", null) : null;
  if (error || !record || !book) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={{ title: "Libro" }} />
        <Text style={{ color: th.dangerFg }}>{error ?? "No encontrado"}</Text>
      </View>
    );
  }

  const cover = book.imageUrls.large ?? book.imageUrls.thumbnail ?? null;
  const rows: [string, string][] = (
    [
      ["Autores", book.authors.join(", ")],
      ["Editorial", book.publisher],
      ["Publicado", book.publishedDate],
      ["Páginas", book.pageCount != null ? String(book.pageCount) : null],
      ["Idioma", book.language ? book.language.toUpperCase() : null],
      ["Categorías", book.categories.join(", ")],
      ["ISBN", book.isbn13 ?? book.isbn10],
      [
        "Valoración",
        book.averageRating != null
          ? `★ ${book.averageRating.toFixed(1)} (${book.ratingsCount ?? 0})`
          : null,
      ],
    ] as [string, string | null | undefined][]
  ).filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <>
      <Stack.Screen options={{ title: "Libro" }} />
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: th.imagePlaceholder }]}>
              <Ionicons name="book-outline" size={40} color={th.textSubtle} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={[styles.title, { color: th.text }]}>{book.title}</Text>
            {book.subtitle ? (
              <Text style={[styles.subtitle, { color: th.textMuted }]}>{book.subtitle}</Text>
            ) : null}
            {book.authors.length > 0 ? (
              <Text style={[styles.authors, { color: th.textMuted }]} numberOfLines={2}>
                {book.authors.join(", ")}
              </Text>
            ) : null}
            {book.averageRating != null ? (
              <Text style={[styles.rating, { color: th.accent }]}>★ {book.averageRating.toFixed(1)}</Text>
            ) : null}
          </View>
        </View>

        {rows.length > 0 && (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={[styles.rowKey, { color: th.textSubtle }]}>{k}</Text>
                <Text style={[styles.rowVal, { color: th.text }]} numberOfLines={3}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
        )}

        {book.description ? (
          <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
            <Text style={[styles.descTitle, { color: th.textMuted }]}>Sinopsis</Text>
            <Text style={[styles.descText, { color: th.text }]}>{book.description}</Text>
          </View>
        ) : null}

        {book.detailUrl ? (
          <Pressable
            onPress={() => void Linking.openURL(book.detailUrl!)}
            style={[styles.cta, { backgroundColor: th.primary }]}
          >
            <Ionicons name="open-outline" size={18} color={th.primaryFg} />
            <Text style={[styles.ctaText, { color: th.primaryFg }]}>
              Ver en{" "}
              {book.source === "OPEN_LIBRARY"
                ? "Open Library"
                : book.source === "GOOGLE_BOOKS"
                ? "Google Books"
                : "la web"}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 6, paddingBottom: 40 },
  hero: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  cover: { width: 110, height: 165, borderRadius: 8 },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroInfo: { flex: 1, gap: 3 },
  title: { fontSize: 19, fontWeight: "700" },
  subtitle: { fontSize: 14 },
  authors: { fontSize: 14, marginTop: 2 },
  rating: { fontSize: 16, fontWeight: "700", marginTop: 6 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  rowKey: { fontSize: 13 },
  rowVal: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  descTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  descText: { fontSize: 14, lineHeight: 20 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 10,
    marginTop: 16,
  },
  ctaText: { fontSize: 15, fontWeight: "600" },
});
