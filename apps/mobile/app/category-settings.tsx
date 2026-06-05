import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";
import { useCategoryPrefs } from "@/lib/records/category-prefs-context";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { ReorderableCategoryList } from "@/components/ReorderableCategoryList";
import { Button, Chip, Section } from "@/components/ui";

/**
 * Ajustes de CATEGORÍAS (Cuenta → Categorías). Reordenar el menú arrastrando,
 * ocultar/recuperar categorías (toggle ojo), elegir la categoría de inicio y
 * restablecer todas las preferencias. Stack screen hermana de (tabs); lee el
 * estado vivo del CategoryPrefsProvider (root). Todo local (SecureStore).
 */
export default function CategorySettingsScreen() {
  const { th, setThemeMode } = useTheme();
  const {
    managed,
    orderedVisible,
    reorder,
    commitOrder,
    toggleHidden,
    startCategory,
    setStartCategory,
    reset,
  } = useCategoryPrefs();
  const [scrollOn, setScrollOn] = useState(true);

  // Solo se puede arrancar en una categoría DESARROLLADA (enabled) y visible — así
  // no se puede dejar la app en una pantalla "Próximamente" al abrir.
  const startOptions = orderedVisible.filter((t) => RECORD_TYPE_CONFIG[t].enabled);
  const effectiveStart =
    (startCategory && startOptions.includes(startCategory) && startCategory) ||
    (startOptions.includes("property") ? "property" : startOptions[0]);

  function confirmReset() {
    Alert.alert(
      "Restablecer preferencias",
      "Volverán a fábrica el orden y la visibilidad de categorías, la categoría de inicio, el tema y el orden manual de tus registros. No se borra ningún registro.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: () => {
            reset();
            setThemeMode("auto");
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: th.bg }}
      contentContainerStyle={styles.content}
      scrollEnabled={scrollOn}
    >
      <Section label="Orden y visibilidad">
        <Text style={[styles.help, { color: th.textSubtle }]}>
          Mantén pulsada una categoría y arrástrala para reordenar · toca el ojo para ocultarla o
          mostrarla.
        </Text>
        <ReorderableCategoryList
          data={managed}
          onReorder={(next) => reorder(next.map((m) => m.type))}
          onCommit={(next) => commitOrder(next.map((m) => m.type))}
          onToggleHidden={toggleHidden}
          onDragStart={() => setScrollOn(false)}
          onDragEnd={() => setScrollOn(true)}
        />
      </Section>

      <Section label="Categoría de inicio">
        <Text style={[styles.help, { color: th.textSubtle }]}>
          Con qué categoría se abre la app (solo las ya disponibles).
        </Text>
        <View style={styles.chips}>
          {startOptions.map((t) => (
            <Chip
              key={t}
              label={RECORD_TYPE_CONFIG[t].label}
              icon={RECORD_TYPE_CONFIG[t].icon}
              color={RECORD_TYPE_CONFIG[t].color}
              selected={t === effectiveStart}
              onPress={() => setStartCategory(t)}
            />
          ))}
        </View>
      </Section>

      <Button
        label="Restablecer preferencias"
        variant="ghost"
        icon="refresh-outline"
        onPress={confirmReset}
        style={styles.reset}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  help: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reset: { marginTop: 4 },
});
