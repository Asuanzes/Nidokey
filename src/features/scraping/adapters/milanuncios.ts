import type { PortalAdapter } from "../types";

// Milanuncios usa cookies/anti-bot tipo DataDome. Manual-only por ahora.
export const milanunciosAdapter: PortalAdapter = {
  portal: "MILANUNCIOS",
  manualOnly: true,
  matches(url) {
    return /milanuncios\.com\//i.test(url);
  },
  async scrape(_url) {
    return { kind: "blocked", reason: "Milanuncios requiere revisión manual" };
  },
};
