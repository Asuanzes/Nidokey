import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RECORD_TYPES, type BaseRecord } from "@nidokey/shared";
import { useRecordCategory } from "@/lib/records/category-context";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { useRecords } from "@/lib/hooks/useRecords";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { ReorderableRecordList } from "@/components/ReorderableRecordList";
import { deleteRecord } from "@/lib/data/records-repository";
import { getSavedOrder, saveOrder, applySavedOrder } from "@/lib/local-order";
import { EmptyState, Screen } from "@/components/ui";

/**
 * Lista unificada de registros. El filtro de tipo es un rail VERTICAL en el
 * lado derecho (solo iconos, algo más grandes); el tipo activo se marca en
 * bronce (th.accent) sobre fondo accentSoft, consistente con la tab bar.
 * Solo "property" tiene datos; el resto muestra el estado "Próximamente".
 */
export default function RecordsScreen() {
  const { state } = useAuth();
  const { th } = useTheme();
  // Categoría activa COMPARTIDA con Importar (contexto), no estado local: así
  // Importar abre la categoría en la que estás y "Ver {categoría}" vuelve a ella.
  const { category: type, setCategory: setType } = useRecordCategory();

  const { data: records, error, loading, refreshing, refetch } = useRecords({ type });

  // Modo edición (pulsación larga): muestra ✕ para borrar. Sale al cambiar de
  // tipo o si la lista queda vacía.
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [type]);
  useEffect(() => { if (records && records.length === 0) setEditing(false); }, [records]);

  // Orden manual local: aplica el orden guardado (SecureStore) a los registros
  // traídos. `draggingRef` evita que un refetch en segundo plano pise un
  // arrastre en curso.
  const [items, setItems] = useState<BaseRecord[] | null>(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!records) { setItems(null); return; }
    let cancel = false;
    getSavedOrder(type).then((ids) => {
      if (cancel || draggingRef.current) return;
      setItems(applySavedOrder(records, ids));
    });
    return () => { cancel = true; };
  }, [records, type]);

  async function handleDelete(record: BaseRecord) {
    Alert.alert(
      "Eliminar registro",
      `¿Eliminar "${record.title}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRecord(record);
              await refetch();
            } catch (e) {
              Alert.alert("No se pudo eliminar", e instanceof Error ? e.message : "Error desconocido");
            }
          },
        },
      ],
    );
  }

  if (state.kind !== "authed") return null;

  const cfg = RECORD_TYPE_CONFIG[type];
  const ordered = items ?? records;

  return (
    <Screen>
      <View style={styles.body}>
        {/* Contenido */}
        <View style={styles.main}>
          {loading && !records && (
            <View style={styles.center}>
              <ActivityIndicator color={th.primary} />
            </View>
          )}

          {error && (
            <EmptyState
              icon="cloud-offline-outline"
              title="No se pudieron cargar los registros"
              description={error.message}
              actionLabel="Reintentar"
              onAction={refetch}
            />
          )}

          {records && records.length === 0 && !error && (
            <EmptyState
              icon={cfg.enabled ? "file-tray-outline" : "time-outline"}
              title={cfg.enabled ? `Sin ${cfg.label.toLowerCase()} todavía` : "Próximamente"}
              description={
                cfg.enabled
                  ? "Comparte una URL de un portal a Nidokey desde la pestaña Importar."
                  : `El tipo "${cfg.label}" estará disponible pronto.`
              }
            />
          )}

          {ordered && ordered.length > 0 && (
            <View style={styles.fill}>
              {editing && (
                <View style={[styles.editBar, { backgroundColor: th.accentSoft, borderBottomColor: th.border }]}>
                  <Text style={[styles.editHint, { color: th.textMuted }]} numberOfLines={1}>
                    Arrastra para reordenar · ✕ borra
                  </Text>
                  <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                    <Text style={[styles.editDone, { color: th.accent }]}>Listo</Text>
                  </Pressable>
                </View>
              )}
              <ReorderableRecordList
                data={ordered}
                editing={editing}
                refreshing={refreshing}
                onRefresh={refetch}
                onEnterEdit={() => setEditing(true)}
                onDelete={handleDelete}
                onReorder={(next) => setItems(next)}
                onCommit={(ids) => { void saveOrder(type, ids); }}
                onDragStart={() => { draggingRef.current = true; }}
                onDragEnd={() => { draggingRef.current = false; }}
                tintColor={th.primary}
                contentStyle={styles.list}
              />
            </View>
          )}
        </View>

        {/* Rail vertical de tipos (solo iconos, activo en bronce) */}
        <ScrollView
          style={[styles.rail, { borderLeftColor: th.border }]}
          contentContainerStyle={styles.railContent}
          showsVerticalScrollIndicator={false}
        >
          {RECORD_TYPES.map((t) => {
            const c = RECORD_TYPE_CONFIG[t];
            const active = type === t;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: active }}
                style={[styles.railItem, active && { backgroundColor: th.accentSoft }]}
              >
                <Ionicons name={c.icon} size={26} color={active ? th.accent : th.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  fill: { flex: 1 },
  list: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 14 },
  editBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editHint: { fontSize: 12, fontWeight: "500", flex: 1, marginRight: 8 },
  editDone: { fontSize: 14, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  rail: {
    width: 60,
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  railContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
    alignItems: "center",
  },
  railItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
