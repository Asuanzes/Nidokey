import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";

import { api } from "@/lib/api";

/**
 * Notificaciones push del chat (lado cliente). Registra el token de Expo en el
 * backend (/api/devices), gestiona el canal Android y el deep-link al tocar una
 * notificación. IMPORTANTE: recibir push requiere un BUILD NATIVO (EAS build),
 * no basta una OTA, porque expo-notifications es módulo nativo; en iOS además
 * necesita APNs (cuenta Apple de pago). El envío (backend) ya funciona al
 * desplegar.
 */

// En primer plano: mostrar banner salvo que el usuario esté en esa conversación
// (lo decide setActiveConversation). Sonido sí, badge gestionado por el SO.
let activeConversationId: string | null = null;
export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

Notifications.setNotificationHandler({
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

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** Pide permiso, obtiene el token de Expo y lo registra en el backend. */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return; // los emuladores no reciben push

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
    if (!Device.isDevice) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
    await api("/api/devices", { method: "DELETE", body: JSON.stringify({ expoPushToken: token }) });
  } catch {
    // ignore
  }
}

/** Suscribe el deep-link: al tocar una notificación de chat, abre la conversación. */
export function useChatNotificationTap(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string; conversationId?: string } | undefined;
    if (data?.type === "chat" && data.conversationId) {
      router.push(`/chat/${data.conversationId}` as never);
    }
  });
  return () => sub.remove();
}
