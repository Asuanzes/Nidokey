import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { metaField, type BaseRecord, type Book } from "@nidokey/shared";
import { fonts } from "@/lib/fonts";
import { useTheme } from "@/lib/theme";
import { RecordCard } from "@/components/RecordCard";

/**
 * Lista de LIBROS agrupada por autor (B7) — vista de lectura, no de edición:
 *  - Autor con >1 libro → sección plegable inline (cabecera con chevron + nº).
 *  - Autor con 1 libro (o sin autor) → tarjeta suelta, sin cabecera.
 *  - Orden: autores alfabético (es, sin tildes); los sin autor al final.
 *
 * El modo edición (pulsación larga) lo gestiona la pantalla: cambia a la lista
 * plana ReorderableRecordList, donde el arrastre y el borrado funcionan como
 * siempre — así no mezclamos drag con secciones. Dentro de cada sección se
 * respeta el orden manual guardado (el de `data`). El estado plegado vive en
 * memoria (no se persiste): al volver a la pantalla todo aparece desplegado.
 */

type Props = {
  data: BaseRecord[];
  refreshing: boolean;
  onRefresh: () => void;
  /** Long-press sobre una ficha → la pantalla entra en modo edición (lista plana). */
  onEnterEdit: () => void;
  tintColor: string;
  contentStyle?: StyleProp<ViewStyle>;
};

type Group = { author: string | null; items: BaseRecord[] };

/** Primer autor del libro (meta.book.authors[0]); cae a meta.authors ("A, B"). */
function authorOf(r: BaseRecord): string | null {
  const book = metaField<Book | null>(r, "book", null);
  const fromBook = book?.authors?.[0]?.trim();
  if (fromBook) return fromBook;
  const joined = metaField<string | null>(r, "authors", null);
  const first = joined?.split(",")[0]?.trim();
  return first || null;
}

/** Agrupa preservando el orden de `data` dentro de cada autor; autores en
 *  alfabético (insensible a tildes/mayúsculas) y los sin autor al final. */
function groupByAuthor(data: BaseRecord[]): Group[] {
  const byAuthor = new Map<string, BaseRecord[]>();
  const loose: BaseRecord[] = [];
  for (const r of data) {
    const a = authorOf(r);
    if (!a) {
      loose.push(r);
      continue;
    }
    const key = a.toLowerCase();
    const arr = byAuthor.get(key);
    if (arr) arr.push(r);
    else byAuthor.set(key, [r]);
  }
  const groups: Group[] = [...byAuthor.values()].map((items) => ({
    author: authorOf(items[0]),
    items,
  }));
  groups.sort((g1, g2) =>
    (g1.author ?? "").localeCompare(g2.author ?? "", "es", { sensitivity: "base" })
  );
  // Sin autor: tarjetas sueltas al final, en su orden original.
  for (const r of loose) groups.push({ author: null, items: [r] });
  return groups;
}

export function BooksByAuthor({
  data,
  refreshing,
  onRefresh,
  onEnterEdit,
  tintColor,
  contentStyle,
}: Props) {
  const { th } = useTheme();
  const groups = useMemo(() => groupByAuthor(data), [data]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(authorKey: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(authorKey)) next.delete(authorKey);
      else next.add(authorKey);
      return next;
    });
  }

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tintColor} />
      }
    >
      {groups.map((g) => {
        // 1 libro (o sin autor) → tarjeta suelta, como en la lista plana.
        if (g.items.length === 1) {
          return (
            <Animated.View key={g.items[0].id} layout={LinearTransition.duration(180)}>
              <RecordCard record={g.items[0]} onLongPress={onEnterEdit} />
            </Animated.View>
          );
        }
        const key = (g.author ?? "").toLowerCase();
        const isCollapsed = collapsed.has(key);
        return (
          <Animated.View key={`author:${key}`} layout={LinearTransition.duration(180)}>
            <Pressable
              onPress={() => toggle(key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}
              accessibilityLabel={`${g.author} (${g.items.length})`}
              style={({ pressed }) => [styles.header, pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name={isCollapsed ? "chevron-forward" : "chevron-down"}
                size={15}
                color={th.textMuted}
              />
              <Text style={[styles.author, { color: th.text }]} numberOfLines={1}>
                {g.author}
              </Text>
              <View style={[styles.countChip, { backgroundColor: th.accentSoft }]}>
                <Text style={[styles.countText, { color: th.accent }]}>{g.items.length}</Text>
              </View>
            </Pressable>
            {!isCollapsed &&
              g.items.map((record) => (
                <Animated.View key={record.id} layout={LinearTransition.duration(180)}>
                  <RecordCard record={record} onLongPress={onEnterEdit} />
                </Animated.View>
              ))}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  author: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold },
  countChip: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 11, fontFamily: fonts.bodyBold },
});
