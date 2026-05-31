import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { RECORD_TYPES, type RecordType } from "@nidokey/shared";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { useRecords } from "@/lib/hooks/useRecords";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { RecordCard } from "@/components/RecordCard";
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
  const [type, setType] = useState<RecordType>("property");

  const { data: records, error, loading, refreshing, refetch } = useRecords({ type });

  if (state.kind !== "authed") return null;

  const cfg = RECORD_TYPE_CONFIG[type];

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
  list: { padding: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  rail: {
    width: 60,
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
  },
  railContent: {
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
