import { Slot, Link, usePathname } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";

function BrandKey({ size = 24, primary = "#3A5F8A", accent = "#B87333" }: {
  size?: number; primary?: string; accent?: string;
}) {
  const sc = size / 24;
  const sw = 1.5 * sc;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", left: (6.5 - 3.3) * sc - sw / 2, top: (12 - 3.3) * sc - sw / 2, width: 3.3 * 2 * sc + sw, height: 3.3 * 2 * sc + sw, borderRadius: (3.3 * 2 * sc + sw) / 2, borderWidth: sw, borderColor: primary, backgroundColor: "transparent" }} />
      <View style={{ position: "absolute", left: (6.5 - 0.85) * sc, top: (8 - 0.85) * sc, width: 0.85 * 2 * sc, height: 0.85 * 2 * sc, borderRadius: 0.85 * sc, backgroundColor: accent }} />
      <View style={{ position: "absolute", left: 9.8 * sc, top: 12 * sc - sw / 2, width: (17 - 9.8) * sc, height: sw, backgroundColor: primary }} />
      <View style={{ position: "absolute", left: 17 * sc, top: 12 * sc, width: (21 - 17) * sc, height: (15.5 - 12) * sc, backgroundColor: accent }} />
      <View style={{ position: "absolute", left: 17 * sc, top: 15.5 * sc, width: (18.5 - 17) * sc, height: (17 - 15.5) * sc, backgroundColor: accent }} />
      <View style={{ position: "absolute", left: 20 * sc, top: 15.5 * sc, width: (21 - 20) * sc, height: (17 - 15.5) * sc, backgroundColor: accent }} />
    </View>
  );
}

export default function TabsLayout() {
  const pathname   = usePathname();
  const insets     = useSafeAreaInsets();
  const [dupCount, setDupCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { dark, th, toggleTheme } = useTheme();
  const { state, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    api<{ items: unknown[] }>("/api/matches")
      .then(d => { if (!cancelled) setDupCount(Array.isArray(d?.items) ? d.items.length : 0); })
      .catch((e: unknown) => { if (e instanceof ApiError && e.status === 401) return; });
    return () => { cancelled = true; };
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

  function filled(icon: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
    return icon.toString().replace(/-outline$/, "") as keyof typeof Ionicons.glyphMap;
  }

  const TABS = [
    { href: "/",        label: "Inmuebles", icon: "home-outline"     as const },
    { href: "/matches", label: "Duplic.",   icon: "sparkles-outline" as const, badge: dupCount > 0 ? dupCount : undefined },
    { href: "/search",  label: "Buscar",    icon: "search-outline"   as const },
  ];

  const MENU_NAV = [
    { href: "/dashboard", label: "Dashboard", icon: "grid-outline"              as const },
    { href: "/actividad", label: "Actividad", icon: "pulse-outline"             as const },
    { href: "/importar",  label: "Importar",  icon: "arrow-down-circle-outline" as const },
  ];

  return (
    <SafeAreaView style={[styles.frame, { backgroundColor: th.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View style={[styles.tabBar, { backgroundColor: th.surface, borderTopColor: th.border, paddingBottom: insets.bottom }]}>
        {TABS.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} asChild>
              <Pressable style={styles.tabItem} accessibilityLabel={tab.label}>
                <View style={styles.iconWrap}>
                  {tab.href === "/" ? (
                    <BrandKey size={24} primary={active ? th.accent : th.textMuted} accent={active ? th.accent : th.textMuted} />
                  ) : (
                    <Ionicons name={active ? filled(tab.icon) : tab.icon} size={24} color={active ? th.accent : th.textMuted} />
                  )}
                  {tab.badge ? (
                    <View style={[styles.badge, { backgroundColor: th.dangerFg }]}>
                      <Text style={styles.badgeText}>{tab.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, { color: active ? th.accent : th.textMuted }]}>{tab.label}</Text>
              </Pressable>
            </Link>
          );
        })}
        <Pressable style={styles.tabItem} onPress={() => setMenuOpen(true)} accessibilityLabel="Menú">
          <Ionicons name="menu-outline" size={24} color={th.textMuted} />
          <Text style={[styles.tabLabel, { color: th.textMuted }]}>Menú</Text>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalWrap}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={() => setMenuOpen(false)} />
          <View style={[styles.drawer, { backgroundColor: th.surface, paddingBottom: insets.bottom + 8 }]}>
            <View style={[styles.handle, { backgroundColor: th.border }]} />
            {state.kind === "authed" && (
              <View style={[styles.profileRow, { borderBottomColor: th.border }]}>
                <View style={[styles.avatar, { backgroundColor: th.primarySoft }]}>
                  <Text style={[styles.avatarText, { color: th.primary }]}>{state.user.email.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileEmail, { color: th.text }]} numberOfLines={1}>{state.user.email}</Text>
                  {state.user.name ? <Text style={[styles.profileName, { color: th.textMuted }]}>{state.user.name}</Text> : null}
                </View>
              </View>
            )}
            {MENU_NAV.map(item => (
              <Link key={item.href} href={item.href} asChild>
                <Pressable style={[styles.menuRow, { borderBottomColor: th.border }]} onPress={() => setMenuOpen(false)}>
                  <Ionicons name={item.icon} size={20} color={th.textMuted} />
                  <Text style={[styles.menuLabel, { color: th.text }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward-outline" size={15} color={th.textSubtle} />
                </Pressable>
              </Link>
            ))}
            <Pressable style={[styles.menuRow, { borderBottomColor: th.border }]} onPress={toggleTheme}>
              <Ionicons name={dark ? "sunny-outline" : "moon-outline"} size={20} color={th.textMuted} />
              <Text style={[styles.menuLabel, { color: th.text }]}>{dark ? "Modo claro" : "Modo oscuro"}</Text>
              <View style={[styles.track, { backgroundColor: dark ? th.accent : th.border }]}>
                <View style={[styles.knob, { transform: [{ translateX: dark ? 16 : 2 }] }]} />
              </View>
            </Pressable>
            <View style={[styles.menuRow, styles.dimmed, { borderBottomColor: th.border }]}>
              <Ionicons name="settings-outline" size={20} color={th.textSubtle} />
              <Text style={[styles.menuLabel, { color: th.textSubtle }]}>Ajustes</Text>
              <View style={[styles.pill, { borderColor: th.border }]}>
                <Text style={[styles.pillText, { color: th.textSubtle }]}>Próximamente</Text>
              </View>
            </View>
            <Pressable style={[styles.menuRow, { borderBottomColor: "transparent" }]} onPress={() => { setMenuOpen(false); setTimeout(logout, 200); }}>
              <Ionicons name="log-out-outline" size={20} color={th.dangerFg} />
              <Text style={[styles.menuLabel, { color: th.dangerFg }]}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame:   { flex: 1 },
  content: { flex: 1 },
  tabBar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  iconWrap: { position: "relative" },
  tabLabel: { fontSize: 10, fontWeight: "500" },
  badge: { position: "absolute", top: -4, right: -8, minWidth: 14, height: 14, paddingHorizontal: 3, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  modalWrap: { flex: 1 },
  drawer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText:   { fontSize: 16, fontWeight: "600" },
  profileEmail: { fontSize: 14, fontWeight: "500" },
  profileName:  { fontSize: 12, marginTop: 2 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  dimmed:    { opacity: 0.5 },
  menuLabel: { flex: 1, fontSize: 15 },
  track: { width: 36, height: 20, borderRadius: 10, justifyContent: "center" },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  pill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: "500" },
});
