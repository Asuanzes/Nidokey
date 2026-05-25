import type { PortalAdapter } from "../types";

// Yaencontre adoptó DataDome (confirmado en logs del sidecar: el HTML que
// devuelve incluye el challenge JS de DataDome con cid, hsh, etc.).
// Sin captcha-solver de pago no se vence. Manual-only vía userscript.
export const yaencontreAdapter: PortalAdapter = {
  portal: "YAENCONTRE",
  manualOnly: true,
  matches(url) {
    return /yaencontre\.com\//i.test(url);
  },
  async scrape(_url) {
    return { kind: "blocked", reason: "Yaencontre usa DataDome — usa el userscript" };
  },
};
