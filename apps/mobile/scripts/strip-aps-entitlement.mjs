/**
 * Quita el entitlement `aps-environment` (Push Notifications) del proyecto iOS.
 *
 * Por qué: el SDK de Expo aplica AUTOMÁTICAMENTE el config plugin de
 * expo-notifications por estar instalado el paquete (aunque no esté en
 * app.json#plugins), y los equipos personales de Apple (cuenta gratuita) no
 * pueden firmar Push Notifications → xcodebuild error 65. El paquete no se
 * puede desinstalar (Android usa el push y Metro resuelve el require en
 * tiempo de bundle).
 *
 * Uso (tras `expo prebuild -p ios`):  node scripts/strip-aps-entitlement.mjs
 * O todo junto:                       npm run ios:device
 *
 * Cuando haya cuenta Apple de pago: dejar de usar este script (y re-añadir
 * ["expo-notifications", {"color": "#6C5A9C"}] a app.json + quitar el
 * early-return de iOS en lib/chat/push.ts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../ios/Nidokey/Nidokey.entitlements", import.meta.url));

let xml;
try {
  xml = readFileSync(file, "utf8");
} catch {
  console.error(`[strip-aps] no existe ${file} — ejecuta antes: npx expo prebuild -p ios`);
  process.exit(1);
}

const out = xml.replace(/\s*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>/g, "");
if (out === xml) {
  console.log("[strip-aps] aps-environment no estaba (nada que hacer)");
} else {
  writeFileSync(file, out);
  console.log("[strip-aps] aps-environment eliminado de Nidokey.entitlements ✓");
}
