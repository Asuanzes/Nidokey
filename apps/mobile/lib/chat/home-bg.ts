import type { ImageSourcePropType } from "react-native";

/**
 * Fondos de la landing del chat (lista de conversaciones), con ROTACIÓN diaria.
 * 4 fondos por tema; cada 24 h se muestra el siguiente del set del tema activo.
 * Optimizados a 720×1480 (~la franja inferior recortada para quitar marcas de
 * agua de los originales). El velo de legibilidad lo pone ConversationList.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const LIGHT: ImageSourcePropType[] = [
  require("../../assets/images/chat-bg/home-light-1.jpg"),
  require("../../assets/images/chat-bg/home-light-2.jpg"),
  require("../../assets/images/chat-bg/home-light-3.jpg"),
  require("../../assets/images/chat-bg/home-light-4.jpg"),
];
const DARK: ImageSourcePropType[] = [
  require("../../assets/images/chat-bg/home-dark-1.jpg"),
  require("../../assets/images/chat-bg/home-dark-2.jpg"),
  require("../../assets/images/chat-bg/home-dark-3.jpg"),
  require("../../assets/images/chat-bg/home-dark-4.jpg"),
];
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Fondo del día para el tema activo. El índice avanza una posición cada día
 * (días enteros desde epoch), así que rota 1→2→3→4→1… cada 24 h. Devuelve la
 * MISMA referencia durante todo el día (no recarga la imagen en cada render).
 */
export function homeBackground(dark: boolean): ImageSourcePropType {
  const set = dark ? DARK : LIGHT;
  const dayIndex = Math.floor(Date.now() / 86_400_000) % set.length;
  return set[dayIndex];
}
