import { AppState, type AppStateStatus } from "react-native";
import { getWsTicket } from "./api";

/**
 * Cliente del gateway WS de tiempo real (F3). Usa el `WebSocket` global de React
 * Native (sin dependencias nativas → 100% OTA).
 *
 * Modelo: el gateway manda avisos OPACOS — `{type:"message", conversationId}` (el
 * contenido se pide a Neon con un refetch) y relaya `{type:"typing", …}`. Si no
 * hay gateway configurado (ticket null) o el socket cae, la app sigue por POLLING
 * (degradación elegante); el socket solo ADELANTA el refresco.
 *
 * Singleton: una conexión por sesión. `connect()` al autenticar, `disconnect()`
 * en logout. Reconexión con backoff; se pausa en segundo plano (batería) y
 * reconecta al volver a primer plano. Tickets de 60 s → uno fresco por conexión.
 */

type MessageEvt = { conversationId: string };
type TypingEvt = { conversationId: string; userId: string; on: boolean };
type MessageListener = (e: MessageEvt) => void;
type TypingListener = (e: TypingEvt) => void;

function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice("https://".length);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice("http://".length);
  return httpUrl;
}

class ChatSocket {
  private ws: WebSocket | null = null;
  private enabled = false;
  private connecting = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private readonly subscriptions = new Set<string>();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly typingListeners = new Set<TypingListener>();

  /** Arranca el cliente (idempotente). Llamar al autenticar. */
  connect(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.attempts = 0;
    if (!this.appStateSub) {
      this.appStateSub = AppState.addEventListener("change", this.onAppState);
    }
    void this.open();
  }

  /** Para el cliente y cierra el socket. Llamar en logout. */
  disconnect(): void {
    this.enabled = false;
    this.clearReconnect();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.subscriptions.clear();
    this.closeSocket();
  }

  private onAppState = (s: AppStateStatus): void => {
    if (!this.enabled) return;
    if (s === "active") {
      // Volver a primer plano: reconectar ya (sin esperar al backoff).
      this.attempts = 0;
      if (!this.isOpen() && !this.connecting) void this.open();
    } else if (s === "background") {
      // Ahorro de batería: soltar el socket; el polling cubre el segundo plano.
      this.clearReconnect();
      this.closeSocket();
    }
  };

  private isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private async open(): Promise<void> {
    if (!this.enabled || this.connecting || this.isOpen()) return;
    this.connecting = true;
    try {
      const { ticket, url } = await getWsTicket();
      if (!this.enabled) return;
      if (!ticket || !url) {
        // Sin gateway configurado: no insistir. Reintenta al próximo foreground/login.
        this.connecting = false;
        return;
      }
      const ws = new WebSocket(`${toWsUrl(url)}/ws?ticket=${encodeURIComponent(ticket)}`);
      this.ws = ws;
      ws.onopen = () => {
        this.connecting = false;
        this.attempts = 0;
        this.sendSubscribe();
      };
      ws.onmessage = (ev) => this.onMessage(ev);
      ws.onclose = () => {
        this.connecting = false;
        if (this.ws === ws) this.ws = null;
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        // onclose se dispara después; ahí se programa la reconexión.
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  private onMessage(ev: { data: unknown }): void {
    let msg: { type?: string; conversationId?: string; userId?: string; on?: boolean };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "message" && msg.conversationId) {
      const e = { conversationId: msg.conversationId };
      this.messageListeners.forEach((cb) => cb(e));
    } else if (msg.type === "typing" && msg.conversationId && msg.userId) {
      const e = { conversationId: msg.conversationId, userId: msg.userId, on: !!msg.on };
      this.typingListeners.forEach((cb) => cb(e));
    }
    // type "ready" → no-op.
  }

  private scheduleReconnect(): void {
    if (!this.enabled || this.reconnectTimer) return;
    this.attempts += 1;
    const base = Math.min(30_000, 1000 * 2 ** Math.min(this.attempts, 5));
    const delay = base + Math.floor(Math.random() * 500); // jitter
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    this.connecting = false;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  private sendRaw(obj: unknown): void {
    if (this.isOpen()) {
      try {
        this.ws!.send(JSON.stringify(obj));
      } catch {
        /* ignore */
      }
    }
  }

  private sendSubscribe(): void {
    this.sendRaw({ type: "subscribe", conversationIds: [...this.subscriptions] });
  }

  /** Suscribe a una conversación (para recibir "escribiendo…" de sus miembros). */
  subscribe(conversationId: string): void {
    this.subscriptions.add(conversationId);
    this.sendSubscribe();
  }

  unsubscribe(conversationId: string): void {
    this.subscriptions.delete(conversationId);
    this.sendSubscribe();
  }

  /** Anuncia que estoy (o dejo de estar) escribiendo en una conversación. */
  sendTyping(conversationId: string, on: boolean): void {
    this.sendRaw({ type: "typing", conversationId, on });
  }

  /** Suscribe un listener de "mensaje nuevo" (devuelve la función para quitarlo). */
  onMessageEvent(cb: MessageListener): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  /** Suscribe un listener de "escribiendo…" (devuelve la función para quitarlo). */
  onTypingEvent(cb: TypingListener): () => void {
    this.typingListeners.add(cb);
    return () => this.typingListeners.delete(cb);
  }
}

export const chatSocket = new ChatSocket();
