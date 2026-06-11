import * as jose from "jose";

/**
 * Ticket corto para conectar al gateway WebSocket del VPS (F3, tiempo real).
 *
 * NO usa AUTH_SECRET: el VPS nunca recibe ese secreto. Usa CHAT_WS_SECRET
 * (dedicado, mismo valor en Vercel y en el VPS). Issuer propio "nidokey-chat-ws"
 * y caducidad muy corta (60 s): el móvil pide un ticket fresco en cada conexión/
 * reconexión, así una fuga caduca casi al instante.
 */

const ALG = "HS256";
const ISSUER = "nidokey-chat-ws";
const EXPIRY = "60s";

function getSecret(): Uint8Array | null {
  const s = process.env.CHAT_WS_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

/** Emite un ticket WS para `userId`, o null si el tiempo real no está configurado. */
export async function issueWsTicket(userId: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}
