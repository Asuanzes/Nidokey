// Genera el icono de la app con una línea de brillo MUY FINA alrededor del borde,
// consistente en iOS y Android. Reproducible e idempotente: lee de los *.base.png
// (originales pre-brillo) y escribe los PNG que referencia app.json.
//   `node scripts/icon-glow.mjs`
//
// Técnica: banda blanca estrecha (no un degradado ancho) pegada al borde visible,
// con alfa baja. El radio se ajusta a la máscara de cada sistema:
//   - iOS muestra el cuadrado completo enmascarado a squircle  -> línea en ~0.93–1.0
//     (más allá de 1.0 se mantiene el valor: rellena las esquinas redondeadas)
//   - Android (adaptive) solo enseña el viewport central ~72dp -> línea en ~0.59–0.66
// Subir/bajar PEAK = más/menos brillante; mover el primer offset de cada banda
// hacia 1.0/0.66 = línea más fina.
import sharp from "sharp";
import path from "node:path";

const dir = path.resolve("apps/mobile/assets/images");
const SIZE = 1024;
const STEEL = "#3A5F8A"; // --primary

const PEAK = 0.13; // intensidad de la línea (muy tenue, pero nítida)

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
  return stops[stops.length - 1][1]; // pad: r > último offset mantiene el valor
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

// Banda fina pegada al borde del squircle (iOS).
const IOS_GLOW = [
  [0.0, 0.0],
  [0.93, 0.0],
  [0.995, PEAK],
  [1.0, PEAK],
];
// Banda fina pegada al borde del viewport adaptativo (Android).
const ANDROID_GLOW = [
  [0.0, 0.0],
  [0.59, 0.0],
  [0.66, PEAK],
  [1.0, PEAK],
];

const iosGlow = await glowOverlay(IOS_GLOW);
const andGlow = await glowOverlay(ANDROID_GLOW);

// iOS / icono global: a sangre completa, opaco, con la línea fina en el squircle.
await sharp(path.join(dir, "icon.base.png"))
  .resize(SIZE, SIZE)
  .flatten({ background: STEEL })
  .composite([{ input: iosGlow }])
  .png()
  .toFile(path.join(dir, "icon.png"));

// Android foreground (llave centrada): línea fina en el borde del viewport.
await sharp(path.join(dir, "android-icon-foreground.base.png"))
  .resize(SIZE, SIZE)
  .flatten({ background: STEEL })
  .composite([{ input: andGlow }])
  .png()
  .toFile(path.join(dir, "android-icon-foreground.png"));

console.log(`✔ iconos regenerados — línea fina, PEAK=${PEAK} (iOS + Android)`);
