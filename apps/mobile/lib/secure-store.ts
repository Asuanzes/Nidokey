import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Wrapper sobre expo-secure-store con fallback para web.
 *
 * En iOS usa Keychain, en Android EncryptedSharedPreferences.
 * En web (Expo web) usa localStorage como fallback.
 */

const WEB_FALLBACK = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
  if (WEB_FALLBACK) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (WEB_FALLBACK) {
    try { window.localStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (WEB_FALLBACK) {
    try { window.localStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
