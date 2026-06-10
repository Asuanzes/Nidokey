import { api } from "@/lib/api";

/**
 * Adjuntos del chat (lado cliente): pickers + subida a R2 vía presigned PUT.
 *
 * BLINDAJE OTA (mismo patrón que lib/chat/push.ts): expo-image-picker y
 * expo-document-picker son módulos NATIVOS — se cargan con require() en
 * try/catch para que una OTA de este JS sobre un binario viejo no crashee:
 * sin módulo, el botón de adjuntar simplemente no aparece.
 */

type ImagePickerModule = typeof import("expo-image-picker");
type DocumentPickerModule = typeof import("expo-document-picker");

let ImagePicker: ImagePickerModule | null = null;
let DocumentPicker: DocumentPickerModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker") as ImagePickerModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DocumentPicker = require("expo-document-picker") as DocumentPickerModule;
} catch {
  ImagePicker = null;
  DocumentPicker = null;
}

export const pickersAvailable = (): boolean => !!ImagePicker && !!DocumentPicker;

let audioAvailable: boolean | null = null;
/** true si el binario trae expo-audio (notas de voz + reproductor). */
export function audioModuleAvailable(): boolean {
  if (audioAvailable === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("expo-audio");
      audioAvailable = true;
    } catch {
      audioAvailable = false;
    }
  }
  return audioAvailable;
}

export type PickedAttachment = {
  uri: string;
  mime: string;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

/** Galería: hasta maxCount imágenes. [] si el usuario cancela. */
export async function pickImages(maxCount: number): Promise<PickedAttachment[]> {
  if (!ImagePicker) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: maxCount > 1,
    selectionLimit: maxCount,
    quality: 0.8,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    mime: a.mimeType ?? "image/jpeg",
    fileName: a.fileName ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
  }));
}

/** Cámara del sistema (pide permiso). null si cancela o sin permiso. */
export async function takePhoto(): Promise<PickedAttachment | null> {
  if (!ImagePicker) return null;
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    mime: a.mimeType ?? "image/jpeg",
    fileName: a.fileName ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
  };
}

/** Selector de documentos. null si cancela. */
export async function pickDocument(): Promise<PickedAttachment | null> {
  if (!DocumentPicker) return null;
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    mime: a.mimeType ?? "application/octet-stream",
    fileName: a.name ?? null,
  };
}

export type AttachmentPayload = {
  key: string;
  mime: string;
  sizeBytes: number;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

/**
 * Sube UN adjunto: lee el fichero local, pide la URL PUT firmada al backend y
 * sube DIRECTO a R2 (el binario nunca pasa por Vercel). Devuelve el payload
 * para attachments[] del mensaje.
 */
export async function uploadAttachment(
  kind: "IMAGE" | "FILE" | "AUDIO",
  file: PickedAttachment
): Promise<AttachmentPayload> {
  const blob = await (await fetch(file.uri)).blob();
  const mime = (file.mime || blob.type || "application/octet-stream").toLowerCase();
  const sizeBytes = blob.size;

  const presign = await api<{ key: string; uploadUrl: string }>("/api/chat/uploads", {
    method: "POST",
    body: JSON.stringify({ kind, mime, sizeBytes, fileName: file.fileName ?? null }),
  });

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  if (!put.ok) throw new Error(`Subida fallida (${put.status})`);

  return {
    key: presign.key,
    mime,
    sizeBytes,
    fileName: file.fileName ?? null,
    width: file.width ?? null,
    height: file.height ?? null,
    durationMs: file.durationMs ?? null,
  };
}

/** "1,3 MB" / "412 KB" para filas de archivo. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
