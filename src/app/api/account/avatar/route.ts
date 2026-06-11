import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-helpers";
import { CHAT_MIME_ALLOW } from "@/lib/chat/config";
import { presignPut, r2Enabled } from "@/lib/chat/r2";

/**
 * POST /api/account/avatar — presigned PUT a R2 para la foto de perfil.
 * Flujo: presign → PUT directo a R2 → PATCH /api/account { image: key }.
 * Key con timestamp (no fija) para que el cambio rompa cachés (?v=basename).
 */

const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/gif": "gif",
};

const Input = z.object({
  mime: z.string().min(3).max(120),
  sizeBytes: z.coerce.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();

  if (!r2Enabled()) {
    return NextResponse.json({ error: "Avatares no disponibles (R2 sin configurar)" }, { status: 503 });
  }
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const mime = parsed.data.mime.toLowerCase();
  if (!CHAT_MIME_ALLOW.IMAGE.includes(mime)) {
    return NextResponse.json({ error: `Tipo no admitido (${mime})` }, { status: 400 });
  }
  if (parsed.data.sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: "Imagen demasiado grande (máx. 5 MB)" }, { status: 413 });
  }

  const ext = EXT_BY_MIME[mime] ?? "jpg";
  const key = `avatars/${userId}/${Date.now().toString(36)}${randomBytes(6).toString("hex")}.${ext}`;
  const uploadUrl = await presignPut(key, mime);
  return NextResponse.json({ key, uploadUrl }, { status: 201 });
}
