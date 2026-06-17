import { SvgXml } from "react-native-svg";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RecordType } from "@nidokey/shared";

import { useTheme } from "@/lib/theme";
import { useAppStyle } from "@/lib/app-style-context";
import { categoryColor, recordTypeConfig } from "@/lib/records/config";
import { CATEGORY_ICON_SVG } from "@/lib/records/category-icons";
import { NeonIcon } from "@/components/ui/NeonIcon";

type Props = {
  type: RecordType;
  size?: number;
  /** Override del color; por defecto el color de la categoría según tema y estilo. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Icono de categoría, teñido por categoría.
 *  - Vintage: set relleno `CATEGORY_ICON_SVG` (Iconify) vía `SvgXml` (recolor por `currentColor`).
 *  - 2100: icono de LÍNEA con neón — el glifo Ionicons `-outline` de la categoría
 *    (RECORD_TYPE_CONFIG.icon) renderizado con `NeonIcon` (framed=false: footprint
 *    natural + glow, sin pastilla) en el color neón de la categoría.
 */
export function CategoryIcon({ type, size = 24, color, style }: Props) {
  const { dark } = useTheme();
  const { appStyle } = useAppStyle();
  const c = color ?? categoryColor(type, dark, appStyle);

  if (appStyle === "2100") {
    return (
      <View style={style}>
        <NeonIcon name={recordTypeConfig(type).icon} size={size} color={c} framed={false} />
      </View>
    );
  }
  if (appStyle === "operativo") {
    return (
      <View style={style}>
        <Ionicons name={recordTypeConfig(type).icon} size={size} color={c} />
      </View>
    );
  }
  return <SvgXml xml={CATEGORY_ICON_SVG[type]} width={size} height={size} color={c} style={style} />;
}
