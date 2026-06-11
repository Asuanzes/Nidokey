import { useEffect, useState } from "react";
import { chatSocket } from "./socket";

/**
 * Estado vivo del WebSocket de chat (true = conectado). Para el POLLING
 * ADAPTATIVO: con socket abierto los eventos del gateway adelantan el refresco
 * y el polling pasa a ser un fallback lento (30-60 s); con el socket caído los
 * intervalos vuelven a los rápidos (4/10/20 s).
 */
export function useSocketOpen(): boolean {
  const [open, setOpen] = useState(() => chatSocket.isConnected());
  useEffect(() => chatSocket.onConnectionStateChange(setOpen), []);
  return open;
}
