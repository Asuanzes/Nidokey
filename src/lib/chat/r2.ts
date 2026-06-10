import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) para los adjuntos del chat. Bucket PRIVADO:
 * el cliente nunca ve las claves — sube con una URL PUT firmada (10 min) y
 * descarga con URLs GET firmadas (7 días, el máximo de SigV4).
 *
 * Sin las env `R2_*` todo queda inerte: `r2Enabled()` = false, el endpoint de
 * uploads devuelve 503 y los flags attachments/voice se apagan solos (ver
 * config.ts). Así el deploy es seguro antes de crear el bucket.
 */

const PUT_EXPIRY_S = 10 * 60;
const GET_EXPIRY_S = 7 * 24 * 3600; // máximo permitido por SigV4

function envs() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function r2Enabled(): boolean {
  return envs() !== null;
}

let client: S3Client | null = null;
let clientBucket = "";

function getClient(): { client: S3Client; bucket: string } {
  const e = envs();
  if (!e) throw new Error("R2 no configurado (faltan env R2_*)");
  if (!client) {
    // R2_ENDPOINT (opcional) = la URL S3 exacta que muestra Cloudflare junto a
    // las claves. Imprescindible con jurisdicción EU
    // (https://<account_id>.eu.r2.cloudflarestorage.com); sin ella se asume Default.
    const endpoint =
      process.env.R2_ENDPOINT?.trim().replace(/\/+$/, "") ||
      `https://${e.accountId}.r2.cloudflarestorage.com`;
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey },
    });
    clientBucket = e.bucket;
  }
  return { client, bucket: clientBucket };
}

/** URL firmada para SUBIR un objeto (el móvil hace PUT con Content-Type). */
export async function presignPut(key: string, mime: string): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime }), {
    expiresIn: PUT_EXPIRY_S,
  });
}

/** URL firmada para DESCARGAR un objeto. */
export async function presignGet(key: string): Promise<string> {
  const { client, bucket } = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: GET_EXPIRY_S,
  });
}

/**
 * Convierte lo guardado en ChatAttachment.url a URL servible: las keys de R2
 * se firman; URLs http(s) completas (legacy/externas) pasan tal cual. Si R2 no
 * está configurado, la key se devuelve sin firmar (no romper el listado).
 */
export async function signAttachmentUrl(stored: string): Promise<string> {
  if (/^https?:\/\//i.test(stored)) return stored;
  if (!r2Enabled()) return stored;
  try {
    return await presignGet(stored);
  } catch {
    return stored;
  }
}

/** Firma las URLs de los attachments de un MessageDto (mutación barata local). */
export async function signMessageAttachments<T extends { attachments: { url: string }[] }>(dto: T): Promise<T> {
  if (dto.attachments.length === 0) return dto;
  await Promise.all(
    dto.attachments.map(async (a) => {
      a.url = await signAttachmentUrl(a.url);
    })
  );
  return dto;
}
