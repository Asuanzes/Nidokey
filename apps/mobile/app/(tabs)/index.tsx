import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { RECORD_TYPES, type RecordType } from "@nidokey/shared";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { useRecords } from "@/lib/hooks/useRecords";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { RecordCard } from "@/components/RecordCard";
import { Chip, EmptyState, Screen } from "@/components/ui";

/**
 * Lista unificada de registros con filtros por tipo (chips).
 * Hoy solo "property" tiene datos; el resto aparece deshabilitado
 * ("Próximamente") sin necesidad de tocar esta pantalla cuando se activen.
 */
export default function RecordsScreen() {
  const { state } = useAuth();
  const { th } = useTheme();
  const [type, setType] = useState<RecordType>("property");

  const { data: records, error, loading, refreshing, refetch } = useRecords({ type });

  if (state.kind !== "authed") return null;

  const cfg = RECORD_TYPE_CONFIG[type];
  const count = records?.length ?? 0;

  return (
    <Screen title="Registros" subtitle={`${count} ${cfg.label.toLowerCase()}`}>
      {/* Filtros por tipo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {RECORD_TYPES.map((t) => {
          const c = RECORD_TYPE_CONFIG[t];
          return (
            <Chip
              key={t}
              label={c.enabled ? c.label : `${c.label} · pronto`}
              icon={c.icon}
              color={c.color}
              selected={type === t}
              onPress={() => c.enabled && setType(t)}
            />
          );
        })}
      </ScrollView>

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

      {records && records.length > 0 && (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RecordCard record={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={th.primary} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  list: { padding: 16, paddingTop: 4 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
});
