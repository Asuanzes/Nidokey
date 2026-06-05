import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import RNShare from "react-native-share";

import { type BaseRecord, type Book, metaField } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ShareOpenActions } from "@/components/ShareOpenActions";

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
  const [descExpanded, setDescExpanded] = useState(false);
  // Comentario propio del usuario (meta.userNotes). Sin caja a la vista: si no hay,
  // solo un "＋ Añadir comentario"; al tocar aparece el editor.
  const [note, setNote] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<BaseRecord>(`/api/records/${id}?type=book`);
        if (alive) {
          setRecord(r);
          setNote(metaField<string | null>(r, "userNotes", null));
        }
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

  async function saveNote() {
    const text = draftNote.trim();
    setSavingNote(true);
    try {
      await api(`/api/records/${id}?type=book`, {
        method: "PATCH",
        body: JSON.stringify({ notes: text }),
      });
      setNote(text || null);
      setEditingNote(false);
    } catch {
      /* error de red → se queda en modo edición para reintentar */
    } finally {
      setSavingNote(false);
    }
  }

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
    ] as [string, string | null | undefined][]
  ).filter((r): r is [string, string] => Boolean(r[1]));

  const sourceLabel =
    book.source === "OPEN_LIBRARY"
      ? "Open Library"
      : book.source === "GOOGLE_BOOKS"
      ? "Google Books"
      : "la web";
  const bookTitle = book.title;
  const bookAuthors = book.authors;
  const detailUrl = book.detailUrl;
  async function onShare() {
    const msg = [
      bookTitle + (bookAuthors.length ? " — " + bookAuthors.join(", ") : ""),
      detailUrl,
    ]
      .filter((l): l is string => !!l)
      .join("\n");
    try {
      await RNShare.open({ message: `${msg}\n\nNIDOKEY`, failOnCancel: false });
    } catch {
      // cancelado o sin app de destino → ignorar
    }
  }

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
              <RatingStars
                value={book.averageRating}
                count={book.ratingsCount ?? null}
                color={th.accent}
                mutedColor={th.textMuted}
              />
            ) : null}
            {/* Compartir + abrir, abajo-derecha del hero: pegados al thumbnail y
                justo encima de la ficha. marginTop:auto los empuja al fondo del
                hero (que se estira a la altura de la portada). */}
            <ShareOpenActions
              style={styles.heroActions}
              onShare={onShare}
              onOpen={detailUrl ? () => void Linking.openURL(detailUrl) : undefined}
              openLabel={`Ver en ${sourceLabel}`}
            />
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
            <Text
              style={[styles.descText, { color: th.text }]}
              numberOfLines={descExpanded ? undefined : 4}
            >
              {book.description}
            </Text>
            {book.description.length > 200 ? (
              <Pressable onPress={() => setDescExpanded((v) => !v)} hitSlop={8}>
                <Text style={[styles.moreLink, { color: th.primary }]}>
                  {descExpanded ? "Ver menos" : "Ver más"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Mis notas: comentario propio del usuario. Editor oculto hasta que toca. */}
        <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
          {editingNote ? (
            <>
              <Text style={[styles.descTitle, { color: th.textMuted }]}>Mis notas</Text>
              <TextInput
                value={draftNote}
                onChangeText={setDraftNote}
                multiline
                autoFocus
                placeholder="Tu comentario, opinión, dónde lo compraste…"
                placeholderTextColor={th.textSubtle}
                style={[
                  styles.noteInput,
                  { color: th.text, borderColor: th.border, backgroundColor: th.bg },
                ]}
              />
              <View style={styles.noteActions}>
                <Pressable
                  onPress={() => {
                    setEditingNote(false);
                    setDraftNote(note ?? "");
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.noteBtn, { color: th.textMuted }]}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={saveNote} disabled={savingNote} hitSlop={8}>
                  <Text style={[styles.noteBtn, { color: th.primary, fontWeight: "700" }]}>
                    {savingNote ? "Guardando…" : "Guardar"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : note ? (
            <Pressable
              onPress={() => {
                setDraftNote(note);
                setEditingNote(true);
              }}
            >
              <View style={styles.noteHeader}>
                <Text style={[styles.descTitle, { color: th.textMuted, marginBottom: 0 }]}>
                  Mis notas
                </Text>
                <Ionicons name="pencil" size={13} color={th.textSubtle} />
              </View>
              <Text style={[styles.descText, { color: th.text, marginTop: 6 }]}>{note}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setDraftNote("");
                setEditingNote(true);
              }}
              style={styles.addNoteRow}
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={18} color={th.primary} />
              <Text style={[styles.addNoteText, { color: th.primary }]}>Añadir comentario</Text>
            </Pressable>
          )}
        </View>

      </ScrollView>
    </>
  );
}

/** Valoración de lectores: estrellas (Ionicons, con media estrella) + nota + nº de
 *  votos. El dato es opcional (muchos volúmenes no lo traen), por eso el llamador
 *  lo condiciona a averageRating != null. La nota se redondea a la media estrella
 *  más cercana solo para pintar; el número exacto se muestra al lado. */
function RatingStars({
  value,
  count,
  color,
  mutedColor,
}: {
  value: number;
  count: number | null;
  color: string;
  mutedColor: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={rounded >= i ? "star" : rounded >= i - 0.5 ? "star-half" : "star-outline"}
          size={14}
          color={color}
        />
      ))}
      <Text style={[styles.ratingNum, { color }]}>{value.toFixed(1)}</Text>
      {count != null && count > 0 ? (
        <Text style={[styles.ratingCount, { color: mutedColor }]}>
          ({count.toLocaleString("es-ES")})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 6, paddingBottom: 40 },
  hero: { flexDirection: "row", gap: 14, alignItems: "stretch" },
  cover: { width: 110, height: 165, borderRadius: 8 },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroInfo: { flex: 1, gap: 3 },
  title: { fontSize: 19, fontWeight: "700" },
  subtitle: { fontSize: 14 },
  authors: { fontSize: 14, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  ratingNum: { fontSize: 14, fontWeight: "700", marginLeft: 3 },
  ratingCount: { fontSize: 13, fontWeight: "500", marginLeft: 1 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  rowKey: { fontSize: 13 },
  rowVal: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  descTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  descText: { fontSize: 14, lineHeight: 20 },
  moreLink: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  noteInput: { minHeight: 80, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, textAlignVertical: "top" },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", gap: 18, marginTop: 10 },
  noteBtn: { fontSize: 14 },
  noteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addNoteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 2 },
  addNoteText: { fontSize: 14, fontWeight: "600" },
  heroActions: { alignSelf: "flex-end", marginTop: "auto" },
});
