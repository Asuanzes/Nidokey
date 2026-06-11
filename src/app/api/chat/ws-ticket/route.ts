import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { issueWsTicket } from "@/lib/chat/ws-ticket";

/**
 * GET /api/chat/ws-ticket — ticket corto para el gateway WS de tiempo real (F3).
 *
 * Devuelve { ticket, url } si el tiempo real está configurado (CHAT_WS_SECRET +
 * CHAT_GATEWAY_URL). Si no, { ticket: null } con 200: el móvil simplemente sigue
 * con polling, sin romperse. El ticket caduca en 60 s; el cliente pide uno fresco
 * en cada conexión/reconexión.
 */
export async function GET() {
  const userId = await requireUserId();
  const url = process.env.CHAT_GATEWAY_URL?.trim().replace(/\/+$/, "") || null;
  const ticket = url ? await issueWsTicket(userId) : null;
  return NextResponse.json({ ticket, url: ticket ? url : null });
}
