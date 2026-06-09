import { SvgXml } from "react-native-svg";
import type { StyleProp, ViewStyle } from "react-native";
import type { RecordType } from "@nidokey/shared";

import { useTheme } from "@/lib/theme";
import { categoryColor } from "@/lib/records/config";
import { CATEGORY_ICON_SVG } from "@/lib/records/category-icons";

type Props = {
  type: RecordType;
  size?: number;
  /** Override del color; por defecto el color de la categoría según el tema. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Icono de categoría (SVG monocromo de `CATEGORY_ICON_SVG`), teñido por categoría.
 * `SvgXml` mapea su prop `color` a `currentColor` del SVG → recolor por tema trivial.
 */
export function CategoryIcon({ type, size = 24, color, style }: Props) {
  const { dark } = useTheme();
  const c = color ?? categoryColor(type, dark);
  return <SvgXml xml={CATEGORY_ICON_SVG[type]} width={size} height={size} color={c} style={style} />;
}
