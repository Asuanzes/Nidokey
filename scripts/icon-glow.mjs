// ⚠️ LEGACY / SUPERSEDED por scripts/apply-brand-logo.mjs (logo NK sobre crema,
// 2026-06-16). Este script aplicaba el brillo ACERO a la LLAVE dorada (diseño
// viejo). NO ejecutar: rehornearía el icono antiguo. Se conserva como referencia.
//
// Genera el icono de la app con una LÍNEA finísima y brillante que recorre todo
// el contorno exterior, consistente en iOS y Android. Reproducible e idempotente:
// lee de los *.base.png (originales pre-brillo) y escribe los PNG de app.json.
//   `node scripts/icon-glow.mjs`
//
// Técnica: trazo (stroke) que sigue la FORMA real de la máscara mediante el SDF
// de un rectángulo redondeado (rounded-rect ≈ squircle). Al seguir la forma, la
// línea abraza todo el borde (incluidas las esquinas), no invade hacia dentro y
// queda nítida/antialiased — a diferencia de un degradado radial (curvas de nivel
// circulares, que no encajan en un squircle).
//   - iOS muestra el cuadrado completo enmascarado a squircle  -> B=512, R≈229
//   - Android (adaptive) solo enseña el viewport central ~72dp -> B≈341, R≈120
// La línea se sitúa unos px POR DENTRO del borde (INSET) para que la máscara del
// sistema no la recorte.
import sharp from "sharp";
import path from "node:path";

const dir = path.resolve("apps/mobile/assets/images");
const SIZE = 1024;
const STEEL = "#3A5F8A"; // --primary

const PEAK = 0.34;        // brillo de la línea (blanco sobre acero)
const STROKE_HALF = 5;    // semigrosor en px @1024 (línea ≈ 10px -> hairline al render)
const INSET = 12;         // px que la línea entra desde el borde (evita el recorte)
const AA = 1.4;           // suavizado de bordes del trazo

// SDF de rounded-rect centrado: <0 dentro, 0 en el borde, >0 fuera.
function strokeOverlay({ B, R }) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const c = (SIZE - 1) / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x - c;
      const py = y - c;
      const ax = Math.abs(px) - B + R;
      const ay = Math.abs(py) - B + R;
      const ox = Math.max(ax, 0);
      const oy = Math.max(ay, 0);
      const dist = Math.hypot(ox, oy) + Math.min(Math.max(ax, ay), 0) - R;
      // distancia a la línea-centro (situada en dist = -INSET, es decir, dentro)
      const d = Math.abs(dist + INSET);
      const a = Math.max(0, Math.min(1, (STROKE_HALF - d) / AA)) * PEAK;
      const i = (y * SIZE + x) * 4;
      buf[i] = 255;
      buf[i + 1] = 255;
      buf[i + 2] = 255;
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

const iosStroke = await strokeOverlay({ B: 512, R: 229 }); // squircle iOS
const androidStroke = await strokeOverlay({ B: 341, R: 120 }); // rounded-square viewport

// iOS / icono global: a sangre completa, opaco, con la línea fina en el squircle.
await sharp(path.join(dir, "icon.base.png"))
  .resize(SIZE, SIZE)
  .flatten({ background: STEEL })
  .composite([{ input: iosStroke }])
  .png()
  .toFile(path.join(dir, "icon.png"));

// Android foreground (llave centrada): línea fina en el borde del viewport.
await sharp(path.join(dir, "android-icon-foreground.base.png"))
  .resize(SIZE, SIZE)
  .flatten({ background: STEEL })
  .composite([{ input: androidStroke }])
  .png()
  .toFile(path.join(dir, "android-icon-foreground.png"));

console.log(`✔ iconos regenerados — línea fina trazada, PEAK=${PEAK}, grosor≈${STROKE_HALF * 2}px`);
