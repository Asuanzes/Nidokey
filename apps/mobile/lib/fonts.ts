// Tipografía Nidokey. Inter = cuerpo/UI; Poppins = títulos.
// Se cargan con useFonts() en el root (_layout). Son assets JS → viajan por
// OTA (eas update), sin recompilar nativo.
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

/** Assets a pasar a useFonts() en _layout. */
export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

/**
 * Familias por rol (= claves cargadas). OJO RN: el peso va DENTRO de la familia
 * → usa estas constantes como `fontFamily` y NO añadas `fontWeight` además
 * (lo ignora o lo sintetiza mal en Android).
 */
export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "Poppins_600SemiBold",
  headingMedium: "Poppins_500Medium",
  headingBold: "Poppins_700Bold",
} as const;
