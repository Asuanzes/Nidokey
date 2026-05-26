import { Slot, Link, usePathname } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

function BrandKey({ size = 20, primary = "#3A5F8A", accent = "#C49A4D" }: {
  size?: number; primary?: string; accent?: string;
}) {
  const sc = size / 24;
  const sw = 1.5 * sc;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        position: "absolute",
        left: (6.5 - 3.3) * sc - sw / 2,
        top: (12 - 3.3) * sc - sw / 2,
        width: 3.3 * 2 * sc + sw,
        height: 3.3 * 2 * sc + sw,
        borderRadius: (3.3 * 2 * sc + sw) / 2,
        borderWidth: sw,
        borderColor: primary,
        backgroundColor: "transparent",
      }} />
      <View style={{
        position: "absolute",
        left: (6.5 - 0.85) * sc,
        top: (8 - 0.85) * sc,
        width: 0.85 * 2 * sc,
        height: 0.85 * 2 * sc,
        borderRadius: 0.85 * sc,
        backgroundColor: accent,
      }} />
      <View style={{
        position: "absolute",
        left: 9.8 * sc,
        top: 12 * sc - sw / 2,
        width: (17 - 9.8) * sc,
        height: sw,
        backgroundColor: primary,
      }} />
      <View style={{
        position: "absolute",
        left: 17 * sc,
        top: 12 * sc,
        width: (21 - 17) * sc,
        height: (15.5 - 12) * sc,
        backgroundColor: accent,
      }} />
      <View style={{
        position: "absolute",
        left: 17 * sc,
        top: 15.5 * sc,
        width: (18.5 - 17) * sc,
        height: (17 - 15.5) * sc,
        backgroundColor: accent,
      }} />
      <View style={{
        position: "absolute",
        left: 20 * sc,
        top: 15.5 * sc,
        width: (21 - 20) * sc,
        height: (17 - 15.5) * sc,
        backgroundColor: accent,
      }} />
    </View>
  );
}

type RailItem =
  | { sep: true }
  | {
      sep?: false;
      href: string | null;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      badge?: number;
    };

export default function TabsLayout() {
  const pathname = usePathname();
  const [dupCount, setDupCount] = useState(0);
  const { dark, th, toggleTheme } = useTheme();
  const showLabels = Platform.OS === "ios";

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

  const isActive = (href: string | null) => {
    if (!href) return false;
    return href === "/" ? pathname === "/" : pathname?.startsWith(href);
  };

  const railItems: RailItem[] = [
    { href: "/matches",   label: "Duplic.",   icon: "sparkles-outline", badge: dupCount > 0 ? dupCount : undefined },
    { sep: true },
    { href: "/dashboard", label: "Dashboard", icon: "grid-outline" },
    { href: "/actividad", label: "Actividad", icon: "pulse-outline" },
    { sep: true },
    { href: "/importar",  label: "Importar",  icon: "arrow-down-circle-outline" },
  ];

  const resolveIcon = (icon: keyof typeof Ionicons.glyphMap, active: boolean): keyof typeof Ionicons.glyphMap => {
    if (!active) return icon;
    const filled = icon.toString().replace(/-outline$/, "") as keyof typeof Ionicons.glyphMap;
    return filled;
  };

  const footerItems: RailItem[] = [
    { href: "/account", label: "Perfil",  icon: "person-outline" },
    { href: null,       label: "Ajustes", icon: "settings-outline" },
  ];

  function RailItemView({ item }: { item: RailItem }) {
    if (item.sep) {
      return <View style={[styles.separator, { backgroundColor: th.border }]} />;
    }
    const active = !!isActive(item.href);
    const disabled = item.href === null;
    const content = (
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole={disabled ? "none" : "link"}
        disabled={disabled}
        style={[
          styles.item,
          showLabels ? styles.itemIOS : styles.itemAndroid,
          active && { backgroundColor: th.accentSoft },
          disabled && styles.itemDisabled,
        ]}
      >
        <Ionicons
          name={resolveIcon(item.icon, active)}
          size={showLabels ? 20 : 22}
          color={active ? th.accent : disabled ? th.textSubtle : th.textMuted}
        />
        {showLabels && (
          <Text style={[
            styles.itemLabel,
            { color: th.textSubtle },
            active   && { color: th.accent, fontWeight: "600" as const },
            disabled && { color: th.textSubtle },
          ]}>
            {item.label}
          </Text>
        )}
        {item.badge !== undefined && item.badge > 0 && (
          <View style={[
            styles.badge,
            { backgroundColor: th.dangerFg },
            !showLabels && active  ? { borderWidth: 2, borderColor: th.primarySoft } : undefined,
            !showLabels && !active ? { borderWidth: 2, borderColor: th.surface }     : undefined,
          ]}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
      </Pressable>
    );
    if (disabled) return content;
    return (
      <Link key={item.href!} href={item.href!} asChild>
        {content}
      </Link>
    );
  }

  return (
    <SafeAreaView style={[styles.frame, { backgroundColor: th.bg }]} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.row}>
        {/* ===== Vertical rail ===== */}
        <View style={[styles.rail, { backgroundColor: th.surface, borderRightColor: th.border }]}>
          {/* Brand chip → Mis casas */}
          <Link href="/" asChild>
            <Pressable style={styles.brandWrap} accessibilityLabel="Mis casas">
              <View style={[styles.brandChip, { backgroundColor: th.primarySoft }]}>
                <BrandKey size={20} primary={th.primary} accent={th.accent} />
              </View>
            </Pressable>
          </Link>

          {/* Primary nav items */}
          <View style={styles.items}>
            {railItems.map((it, i) => (
              <RailItemView key={i} item={it} />
            ))}
          </View>

          {/* Footer items */}
          <View style={[styles.footer, { borderTopColor: th.border }]}>
            {footerItems.map((it, i) => (
              <RailItemView key={i} item={it} />
            ))}
            {/* Theme toggle */}
            <Pressable
              onPress={toggleTheme}
              style={[
                styles.item,
                showLabels ? styles.itemIOS : styles.itemAndroid,
              ]}
            >
              <Ionicons
                name={dark ? "sunny-outline" : "moon-outline"}
                size={showLabels ? 20 : 22}
                color={th.textMuted}
              />
              {showLabels && (
                <Text style={[styles.itemLabel, { color: th.textSubtle }]}>
                  {dark ? "Claro" : "Oscuro"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ===== Content ===== */}
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  row:   { flex: 1, flexDirection: "row" },

  rail: {
    width: 60,
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },

  brandWrap: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandChip: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  items: {
    flex: 1,
    alignItems: "center",
    width: "100%",
    gap: 16,
  },

  footer: {
    alignItems: "center",
    width: "100%",
    gap: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  separator: {
    width: 36,
    height: 1,
    marginVertical: 4,
  },

  item: {
    position: "relative",
  },
  itemIOS: {
    width: 58,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  itemAndroid: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemDisabled: { opacity: 0.38 },

  itemLabel: {
    fontSize: 9,
    marginTop: 3,
    fontWeight: "400",
  },

  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },

  content: { flex: 1 },
});
