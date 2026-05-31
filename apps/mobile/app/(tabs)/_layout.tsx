import { Slot, Link, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Navegación principal: una sola barra de pestañas con los 5 destinos clave.
 *
 * Antes había un "menú dentro del menú" (botón Menú → bottom-sheet con
 * Importar/Dashboard/Actividad/tema/logout mezclados). Importar, que es la
 * acción principal para añadir registros, quedaba escondida. Ahora todo
 * destino primario es una pestaña; tema y cierre de sesión viven en Cuenta.
 */

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabsLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { th } = useTheme();
  const [dupCount, setDupCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ items: unknown[] }>("/api/matches")
      .then((d) => {
        if (!cancelled) setDupCount(Array.isArray(d?.items) ? d.items.length : 0);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return;
      });
    return () => { cancelled = true; };
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

  const filled = (icon: IconName): IconName =>
    icon.replace(/-outline$/, "") as IconName;

  const TABS: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: "/",         label: "Registros", icon: "albums-outline" },
    { href: "/importar", label: "Importar",  icon: "add-circle-outline" },
    { href: "/search",   label: "Buscar",    icon: "search-outline" },
    { href: "/matches",  label: "Duplic.",   icon: "sparkles-outline", badge: dupCount || undefined },
    { href: "/account",  label: "Cuenta",    icon: "person-outline" },
  ];

  return (
    <SafeAreaView style={[styles.frame, { backgroundColor: th.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View
        style={[
          styles.tabBar,
          { backgroundColor: th.surface, borderTopColor: th.border, paddingBottom: insets.bottom },
        ]}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          const color = active ? th.accent : th.textMuted;
          return (
            <Link key={tab.href} href={tab.href as never} asChild>
              <Pressable style={styles.tabItem} accessibilityLabel={tab.label}>
                <View style={styles.iconWrap}>
                  <Ionicons name={active ? filled(tab.icon) : tab.icon} size={24} color={color} />
                  {tab.badge ? (
                    <View style={[styles.badge, { backgroundColor: th.dangerFg }]}>
                      <Text style={styles.badgeText}>{tab.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  iconWrap: { position: "relative" },
  tabLabel: { fontSize: 10, fontWeight: "500" },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});
