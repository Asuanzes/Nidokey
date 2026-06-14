import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { useAppStyle } from "@/lib/app-style-context";
import { useTheme } from "@/lib/theme";

type Props = {
  name?: keyof typeof Ionicons.glyphMap;
  svgXml?: string;
  size: number;
  color: string;
  active?: boolean;
  disabled?: boolean;
  /** `true` (def.) = contenedor tipo pastilla con halo (tab bar). `false` = footprint
   *  natural (size×size) sin pastilla, solo glifo + glow — para iconos inline (categorías). */
  framed?: boolean;
};

function outlineName(name: keyof typeof Ionicons.glyphMap): keyof typeof Ionicons.glyphMap {
  const raw = String(name);
  if (raw.endsWith("-outline")) return name;
  const next = `${raw}-outline` as keyof typeof Ionicons.glyphMap;
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, next) ? next : name;
}

export function NeonIcon({ name, svgXml, size, color, active = false, disabled = false, framed = true }: Props) {
  const { th } = useTheme();
  const { appStyle } = useAppStyle();
  const effectiveColor = disabled ? th.textSubtle : color;
  const opacity = disabled ? 0.5 : 1;
  const iconName = name ? outlineName(name) : undefined;

  if (appStyle !== "2100") {
    return (
      <View style={{ opacity }}>
        {svgXml ? (
          <SvgXml xml={svgXml} width={size} height={size} color={effectiveColor} />
        ) : iconName ? (
          <Ionicons name={iconName} size={size} color={effectiveColor} />
        ) : null}
      </View>
    );
  }

  const glowEnabled = !disabled;
  const haloOpacity = active ? 0.28 : 0.16;
  // Con marco (tabs): pastilla más ancha + fondo activo. Sin marco (iconos inline de
  // categoría): footprint natural size×size para no descuadrar chips/listas/cabeceras.
  const box = framed
    ? {
        width: size + 14,
        height: Math.max(size + 6, 30),
        borderRadius: th.radii.pill,
        backgroundColor: active && glowEnabled ? th.accentSoft : "transparent",
      }
    : { width: size, height: size };

  return (
    <View
      style={[
        styles.container,
        { ...box, opacity },
        glowEnabled && Platform.OS === "ios"
          ? {
              shadowColor: effectiveColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: active ? 0.9 : 0.55,
              shadowRadius: active ? 8 : 5,
            }
          : null,
      ]}
    >
      {glowEnabled && framed ? (
        <View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderColor: effectiveColor,
              borderRadius: th.radii.pill,
              opacity: haloOpacity,
            },
          ]}
        />
      ) : null}
      {svgXml ? (
        <>
          {glowEnabled ? (
            <SvgXml
              xml={svgXml}
              width={size + 8}
              height={size + 8}
              color={effectiveColor}
              opacity={active ? 0.24 : 0.14}
              style={styles.svgGlow}
            />
          ) : null}
          <SvgXml xml={svgXml} width={size} height={size} color={effectiveColor} />
        </>
      ) : iconName ? (
        <>
          {glowEnabled ? (
            <Ionicons
              name={iconName}
              size={size + 5}
              color={effectiveColor}
              style={[styles.ionGlow, { opacity: active ? 0.22 : 0.12 }]}
            />
          ) : null}
          <Ionicons name={iconName} size={size} color={effectiveColor} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  svgGlow: {
    position: "absolute",
  },
  ionGlow: {
    position: "absolute",
  },
});
