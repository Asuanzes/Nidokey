import type { ImageSourcePropType } from "react-native";

import { deleteItem, getItem, setItem } from "@/lib/secure-store";
import type { I18nKey } from "@/lib/i18n/keys";

/**
 * Fondos de pantalla del chat. Preferencia LOCAL del dispositivo (SecureStore,
 * patrón de category-prefs): un fondo GLOBAL para todos los chats + override
 * por conversación. El otro participante no lo ve (modelo WhatsApp).
 *
 * Añadir un fondo nuevo = copiar el fichero a assets/images/chat-bg/ (~1080px
 * de ancho, JPEG comprimido), añadir UNA entrada aquí y sus claves i18n
 * chat.bg_<id> (es+en). Viaja por OTA (asset del bundle).
 */
export const WALLPAPERS: readonly { id: string; labelKey: I18nKey; source: ImageSourcePropType }[] = [
  { id: "abstracto", labelKey: "chat.bg_abstracto", source: require("../../assets/images/chat-bg/abstracto.jpg") },
  { id: "arena", labelKey: "chat.bg_arena", source: require("../../assets/images/chat-bg/arena.jpg") },
  { id: "modern", labelKey: "chat.bg_modern", source: require("../../assets/images/chat-bg/modern.jpg") },
];

/** id de fondo o "none" (sin fondo). */
export type WallpaperId = string;

const GLOBAL_KEY = "nidokey.chat.wallpaper";
const convKey = (conversationId: string) => `nidokey.chat.wallpaper.${conversationId}`;

/** Fondo efectivo de una conversación: override propio > global > ninguno. */
export async function getWallpaper(conversationId: string): Promise<WallpaperId> {
  try {
    const per = await getItem(convKey(conversationId));
    if (per) return per;
    const glob = await getItem(GLOBAL_KEY);
    return glob ?? "none";
  } catch {
    return "none";
  }
}

/**
 * Guarda la elección. `allChats` = fija el global y borra el override de ESTA
 * conversación (pasa a seguir al global); los overrides de otras se respetan.
 */
export async function setWallpaper(conversationId: string, id: WallpaperId, allChats: boolean): Promise<void> {
  if (allChats) {
    await setItem(GLOBAL_KEY, id);
    await deleteItem(convKey(conversationId)).catch(() => {});
  } else {
    await setItem(convKey(conversationId), id);
  }
}

export function wallpaperSource(id: WallpaperId | null): ImageSourcePropType | null {
  return WALLPAPERS.find((w) => w.id === id)?.source ?? null;
}
