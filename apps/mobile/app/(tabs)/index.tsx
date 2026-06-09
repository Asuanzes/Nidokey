import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { metaField, type BaseRecord } from "@nidokey/shared";
import { useCategoryPrefs } from "@/lib/records/category-prefs-context";
import { useTypeI18n } from "@/lib/records/type-i18n";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useRecords } from "@/lib/hooks/useRecords";
import { useBoot } from "@/lib/boot-context";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ReorderableRecordList } from "@/components/ReorderableRecordList";
import { deleteRecord } from "@/lib/data/records-repository";
import { getSavedOrder, saveOrder, applySavedOrder } from "@/lib/local-order";
import { EmptyState, ResultModal, Screen } from "@/components/ui";
import { NewsSheet } from "@/components/NewsSheet";

/**
 * Lista unificada de registros. El filtro de tipo es un rail VERTICAL en el
 * lado derecho (solo iconos, algo más grandes); el tipo activo se marca en
 * bronce (th.accent) sobre fondo accentSoft, consistente con la tab bar.
 * Solo "property" tiene datos; el resto muestra el estado "Próximamente".
 */
export default function RecordsScreen() {
  const { state } = useAuth();
  const { th } = useTheme();
  const { t } = useTranslation();
  const { label: typeLabel } = useTypeI18n();
  // Categoría activa COMPARTIDA con Importar (contexto), no estado local: así
  // Importar abre la categoría en la que estás y "Ver {categoría}" vuelve a ella.
  const { category: type, setCategory: setType, orderedVisible } = useCategoryPrefs();

  const { data: records, error, loading, refreshing, refetch } = useRecords({ type });

  // Avisa al arranque cuando la primera carga de registros termina (datos o
  // error) → el loader de bolitas se retira. Tapamos así el spinner propio de la
  // lista: una sola carga, no dos.
  const { markFirstScreenReady } = useBoot();
  useEffect(() => {
    if (!loading) markFirstScreenReady();
  }, [loading, markFirstScreenReady]);

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
  // Confirmación de borrado + aviso de error con el estilo de la app (no Alert nativo).
  const [confirmDelete, setConfirmDelete] = useState<BaseRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!records) { setItems(null); return; }
    let cancel = false;
    getSavedOrder(type).then((ids) => {
      if (cancel || draggingRef.current) return;
      setItems(applySavedOrder(records, ids));
    });
    return () => { cancel = true; };
  }, [records, type]);

  function handleDelete(record: BaseRecord) {
    setConfirmDelete(record);
  }

  async function doDelete() {
    const record = confirmDelete;
    setConfirmDelete(null);
    if (!record) return;
    try {
      await deleteRecord(record);
      await refetch();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo eliminar el registro");
    }
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
              title={t("records.load_error")}
              description={error.message}
              actionLabel={t("common.retry")}
              onAction={refetch}
            />
          )}

          {records && records.length === 0 && !error && (
            <EmptyState
              icon={cfg.enabled ? "file-tray-outline" : "time-outline"}
              title={cfg.enabled ? t("records.empty_title", { type: typeLabel(type).toLowerCase() }) : t("common.soon")}
              description={
                cfg.enabled
                  ? t("records.empty_desc")
                  : t("records.soon_desc", { type: typeLabel(type) })
              }
              actionLabel={cfg.enabled ? t("tabs.import") : undefined}
              onAction={cfg.enabled ? () => router.navigate("/importar") : undefined}
            />
          )}

          {ordered && ordered.length > 0 && (
            <View style={styles.fill}>
              {editing && (
                <View style={[styles.editBar, { backgroundColor: th.accentSoft, borderBottomColor: th.border }]}>
                  <Text style={[styles.editHint, { color: th.textMuted }]} numberOfLines={1}>
                    {t("records.edit_hint")}
                  </Text>
                  <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                    <Text style={[styles.editDone, { color: th.accent }]}>{t("common.done")}</Text>
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
          {orderedVisible.map((t) => {
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
                <CategoryIcon type={t} size={26} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sheet de noticias (estilo Bolsa de Apple): solo en categorías financieras,
          con noticias de los activos registrados del usuario. */}
      {(type === "crypto" || type === "market") && (
        <NewsSheet
          type={type}
          assets={(records ?? []).map((r) => ({
            symbol: metaField<string>(r, "symbol", r.title),
            name: r.title,
          }))}
        />
      )}

      {/* Confirmación de borrado (modal de la app) */}
      <ResultModal
        visible={!!confirmDelete}
        tone="error"
        icon="trash-outline"
        title={t("records.delete_title")}
        message={confirmDelete ? t("records.delete_message", { title: confirmDelete.title }) : undefined}
        actions={[
          { label: t("common.delete"), variant: "danger", onPress: () => void doDelete() },
          { label: t("common.cancel"), variant: "ghost", onPress: () => setConfirmDelete(null) },
        ]}
        onRequestClose={() => setConfirmDelete(null)}
      />
      <ResultModal
        visible={!!notice}
        tone="error"
        title={t("records.delete_error")}
        message={notice ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setNotice(null) }]}
        onRequestClose={() => setNotice(null)}
      />
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
  editHint: { fontSize: 12, fontFamily: fonts.bodyMedium, flex: 1, marginRight: 8 },
  editDone: { fontSize: 14, fontFamily: fonts.bodyBold },
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
