import type { PortalAdapter } from "../types";

/**
 * Idealista tiene DataDome — no se puede scrape server-side fiable.
 * Marcamos como manual-only. El cron lo saltará y la UI lo mostrará como
 * "necesita revisión manual".
 */
export const idealistaAdapter: PortalAdapter = {
  portal: "IDEALISTA",
  manualOnly: true,
  matches(url) {
    return /(^|\.)idealista\.(com|es)\//i.test(url);
  },
  async scrape(_url) {
    return { kind: "blocked", reason: "Idealista requiere revisión manual (userscript)" };
  },
};
