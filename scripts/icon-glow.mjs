// Genera el icono de la app con un "rim" de brillo muy tenue alrededor del borde,
// consistente en iOS y Android. Reproducible: `node scripts/icon-glow.mjs`.
//
// Técnica: inverse-vignette (blanco con alfa creciente hacia el perímetro) bakeado
// sobre el fondo acero. El radio del brillo se ajusta a la máscara de cada sistema:
//   - iOS muestra el cuadrado completo enmascarado a squircle  -> brillo en ~0.86–1.0
//   - Android (adaptive) solo enseña el viewport central ~72dp -> brillo en ~0.58–0.66
// Los PNG resultantes sobrescriben los que ya referencia app.json (sin cambiarlo).
import sharp from "sharp";
import path from "node:path";

const dir = path.resolve("apps/mobile/assets/images");
const SIZE = 1024;
const STEEL = "#3A5F8A"; // --primary

// Interpolación lineal por tramos: stops = [[offsetRadial, alfaBlanco], ...]
function ramp(stops, r) {
  if (r <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (r <= stops[i][0]) {
      const [o0, a0] = stops[i - 1];
      const [o1, a1] = stops[i];
      return a0 + (a1 - a0) * ((r - o0) / (o1 - o0));
    }
  }
  return stops[stops.length - 1][1];
}

// Overlay RGBA (blanco) cuyo alfa depende del radio normalizado (1.0 = medio lado).
function glowOverlay(stops) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const c = (SIZE - 1) / 2;
  const half = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.sqrt(dx * dx + dy * dy) / half;
      const a = Math.max(0, Math.min(1, ramp(stops, r)));
      const i = (y * SIZE + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

const IOS_GLOW = [
  [0.0, 0.0],
  [0.62, 0.0],
  [0.86, 0.05],
  [1.0, 0.17],
];
const ANDROID_GLOW = [
  [0.0, 0.0],
  [0.42, 0.0],
  [0.58, 0.05],
  [0.66, 0.17],
  [1.0, 0.17],
];

const iosGlow = await glowOverlay(IOS_GLOW);
const andGlow = await glowOverlay(ANDROID_GLOW);

// iOS / icono global: a sangre completa, opaco, con brillo en el borde del squircle.
const srcIcon = await sharp(path.join(dir, "icon.png")).resize(SIZE, SIZE).toBuffer();
await sharp(srcIcon)
  .flatten({ background: STEEL })
  .composite([{ input: iosGlow }])
  .png()
  .toFile(path.join(dir, "icon.png"));

// Android foreground (llave centrada): brillo en el borde del viewport adaptativo.
const srcFg = await sharp(path.join(dir, "android-icon-foreground.png")).resize(SIZE, SIZE).toBuffer();
await sharp(srcFg)
  .flatten({ background: STEEL })
  .composite([{ input: andGlow }])
  .png()
  .toFile(path.join(dir, "android-icon-foreground.png"));

console.log("✔ iconos regenerados con rim de brillo tenue (iOS + Android)");
