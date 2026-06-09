import { Slot, Link, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { useDuplicatesChanged } from "@/lib/dup-signal";
import { TAB_ICON_SVG, type TabIconKey } from "@/lib/ui-icons";

/**
 * Navegación principal: una sola barra de pestañas con los 5 destinos clave.
 *
 * Antes había un "menú dentro del menú" (botón Menú → bottom-sheet con
 * Importar/Dashboard/Actividad/tema/logout mezclados). Importar, que es la
 * acción principal para añadir registros, quedaba escondida. Ahora todo
 * destino primario es una pestaña; tema y cierre de sesión viven en Cuenta.
 */

type IconName = keyof typeof Ionicons.glyphMap;

/** Color del botón central "Importar": fijo en ambos temas (el primary de
 * modo oscuro aclara demasiado). Steel-blue del modo claro + icono casi blanco. */
const FAB_BG = "#3A5F8A";
const FAB_FG = "#FAFAF7";

export default function TabsLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { th } = useTheme();
  const { t } = useTranslation();
  const [dupCount, setDupCount] = useState(0);
  const dupChanged = useDuplicatesChanged();

  // Recalcula el badge al cambiar de pestaña Y tras fusionar/descartar (dupChanged).
  useEffect(() => {
    let cancelled = false;
    api<{ groups: unknown[] }>("/api/records/duplicates")
      .then((d) => {
        if (!cancelled) setDupCount(Array.isArray(d?.groups) ? d.groups.length : 0);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return;
      });
    return () => { cancelled = true; };
  }, [pathname, dupChanged]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

  const TABS: {
    href: string;
    label: string;
    icon?: IconName;
    svg?: TabIconKey;
    badge?: number;
    primary?: boolean;
  }[] = [
    { href: "/",         label: t("tabs.records"),    svg: "records" },
    { href: "/search",   label: t("tabs.search"),     svg: "search" },
    { href: "/importar", label: t("tabs.import"),     icon: "add", primary: true },
    { href: "/matches",  label: t("tabs.duplicates"), svg: "duplicates", badge: dupCount || undefined },
    { href: "/account",  label: t("tabs.account"),    svg: "account" },
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

          // Acción principal: botón central, más grande y elevado sobre la barra.
          if (tab.primary) {
            return (
              <Link key={tab.href} href={tab.href as never} asChild>
                <Pressable style={styles.fabItem} accessibilityLabel={tab.label}>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.fab,
                        // Azul fijo (steel-blue del modo claro) en ambos temas:
                        // el primary de modo oscuro aclara demasiado y desentona.
                        { backgroundColor: FAB_BG, opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <Ionicons name={tab.icon ?? "add"} size={30} color={FAB_FG} />
                    </View>
                  )}
                </Pressable>
              </Link>
            );
          }

          const color = active ? th.accent : th.textMuted;
          return (
            <Link key={tab.href} href={tab.href as never} asChild>
              <Pressable style={styles.tabItem} accessibilityLabel={tab.label}>
                <View style={styles.iconWrap}>
                  <SvgXml xml={TAB_ICON_SVG[tab.svg!]} width={24} height={24} color={color} />
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
  // Botón central elevado (acción principal "Importar").
  fabItem: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  iconWrap: { position: "relative" },
  tabLabel: { fontSize: 10, fontFamily: fonts.bodyMedium },
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
  badgeText: { color: "#fff", fontSize: 9, fontFamily: fonts.bodyBold },
});
