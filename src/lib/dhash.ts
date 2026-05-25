import sharp from "sharp";

/**
 * dHash perceptual hash de 64 bits.
 *
 * Algoritmo:
 *  1. Resize a 9x8 en escala de grises (72 píxeles).
 *  2. Para cada fila, comparar píxel n con n+1 → 8 bits por fila = 64 bits.
 *  3. Devolver como hex (16 chars).
 *
 * Tolerante a recompresión, redimensionado moderado y ligero recortes.
 * Hamming distance entre dos hashes ≤ 8 → muy probable misma imagen.
 */
export async function computeDhash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  // raw[y*9 + x] = byte de luminancia
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      const left = raw[y * 9 + x];
      const right = raw[y * 9 + x + 1];
      if (left > right) byte |= 1 << (7 - x);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Descarga una URL de imagen y computa su dHash. Devuelve null si falla.
 */
export async function dhashFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null; // imagen muy pequeña, probablemente placeholder
    return await computeDhash(buf);
  } catch {
    return null;
  }
}

/**
 * Hamming distance entre dos hashes hex de 16 chars (64 bits).
 * Devuelve 0..64.
 */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i += 2) {
    const x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    // Brian Kernighan bit count
    let v = x;
    while (v) {
      dist++;
      v &= v - 1;
    }
  }
  return dist;
}
