import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";

import { api } from "@/lib/api";

/**
 * Notificaciones push del chat (lado cliente).
 *
 * BLINDAJE OTA: expo-notifications/expo-device son módulos NATIVOS. Si el
 * binario instalado NO los trae (p. ej. tras una OTA de este JS sobre un build
 * antiguo), importarlos/usarlos crashearía la app al arrancar. Por eso se cargan
 * con require() dentro de try/catch y TODA llamada nativa va protegida: en un
 * binario sin el módulo, el chat funciona y el push queda inerte; con un build
 * nuevo (EAS), el push opera. Recibir push exige BUILD NATIVO, no basta OTA; en
 * iOS además necesita APNs (cuenta Apple de pago) — un dev build con Apple ID
 * gratis envía mensajes pero no recibe push (se auto-desactiva sin crashear).
 */

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications") as NotificationsModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Device = require("expo-device") as DeviceModule;
} catch {
  Notifications = null;
  Device = null;
}

// En primer plano: mostrar banner salvo que estés en esa conversación.
let activeConversationId: string | null = null;
export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

// El handler es JS, pero lo envolvemos por si el módulo nativo falta.
try {
  Notifications?.setNotificationHandler({
    handleNotification: async (notification) => {
      const convId = (notification.request.content.data as { conversationId?: string } | undefined)?.conversationId;
      const muted = convId != null && convId === activeConversationId;
      return {
        shouldShowBanner: !muted,
        shouldShowList: true,
        shouldPlaySound: !muted,
        shouldSetBadge: true,
      };
    },
  });
} catch {
  // binario sin expo-notifications: sin handler, sin crash
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** Pide permiso, obtiene el token de Expo y lo registra en el backend. */
export async function registerForPush(): Promise<void> {
  try {
    if (!Notifications || !Device || !Device.isDevice) return; // sin módulo nativo o emulador

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("chat", {
        name: "Mensajes",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6C5A9C",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await api("/api/devices", {
      method: "POST",
      body: JSON.stringify({ expoPushToken: token, platform: Platform.OS }),
    });
  } catch {
    // Push es best-effort: nunca rompe el arranque/login.
  }
}

/** Baja del token (logout). Mejor esfuerzo. */
export async function unregisterPush(): Promise<void> {
  try {
    if (!Notifications || !Device || !Device.isDevice) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await api("/api/devices", { method: "DELETE", body: JSON.stringify({ expoPushToken: token }) });
  } catch {
    // ignore
  }
}

/** Suscribe el deep-link: al tocar una notificación de chat, abre la conversación. */
export function useChatNotificationTap(): () => void {
  try {
    if (!Notifications) return () => {};
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; conversationId?: string } | undefined;
      if (data?.type === "chat" && data.conversationId) {
        router.push(`/chat/${data.conversationId}` as never);
      }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
