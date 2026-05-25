import type { Portal } from "@prisma/client";
import type { PortalAdapter, ScrapeOutcome } from "../types";
import { loadPage, parsePriceEur, readJsonLd, priceFromJsonLd } from "./_common";
import { isValidPriceEur } from "@buysell/shared";

/**
 * Adaptador genérico para re-check server-side de portales sin anti-bot fuerte.
 *
 * Estrategia de precio (en orden de confianza):
 *   1. JSON-LD `offers.price` — dato estructurado canónico del anuncio.
 *   2. Selectores CSS específicos del portal (lo que el dev confió manualmente).
 *   3. ÚLTIMO recurso: regex sobre <body>, pero solo si los anteriores fallan.
 *
 * Si `previousPriceCents` está disponible, descartamos candidatos > 2x o < 0.5x
 * del anterior antes de elegir — esto evita coger precios de "anuncios
 * relacionados" o banners publicitarios que aparecen en la misma página.
 */
export function makeGenericAdapter(opts: {
  portal: Portal;
  matches: (url: string) => boolean;
  priceSelectors: string[];
  externalIdFromUrl?: (url: string) => string | null;
}): PortalAdapter {
  return {
    portal: opts.portal,
    matches: opts.matches,
    async scrape(url, ctx): Promise<ScrapeOutcome> {
      const page = await loadPage(url);
      if (page.kind !== "ok") return page;
      const { $ } = page;

      const jsonLd = readJsonLd($);
      const prevEur = ctx?.previousPriceCents != null ? ctx.previousPriceCents / 100 : null;

      // Si tenemos precio anterior, todo candidato debe estar dentro de ±50%
      // (rango común para variaciones reales: bajadas hasta -30%, subidas raras).
      function withinRange(p: number): boolean {
        if (!isValidPriceEur(p)) return false;
        if (prevEur == null) return true;
        return p >= prevEur * 0.5 && p <= prevEur * 2;
      }

      let priceEur: number | null = null;

      // 1. JSON-LD primero. Si pasa el filtro, lo usamos sin más.
      const ldPrice = priceFromJsonLd(jsonLd);
      if (ldPrice != null && withinRange(ldPrice)) {
        priceEur = ldPrice;
      }

      // 2. Selectores específicos del portal.
      if (priceEur == null) {
        for (const sel of opts.priceSelectors) {
          let found: number | null = null;
          $(sel).each((_, el) => {
            if (found != null) return;
            const t = $(el).text();
            const p = parsePriceEur(t);
            if (p != null && withinRange(p)) found = p;
          });
          if (found != null) {
            priceEur = found;
            break;
          }
        }
      }

      // 3. Último recurso: si NO había precio anterior (es la primera vez) y
      // los selectores fallaron, escaneamos <body> con regex y nos quedamos
      // con el primero válido. NO usamos Math.max porque la página tiene
      // muchos precios (relacionados, banners) que no son del anuncio.
      if (priceEur == null && prevEur == null) {
        const bodyText = $("body").text();
        const re = /(\d{1,3}(?:\.\d{3})+|\d{6,})\s*€/g;
        let m;
        while ((m = re.exec(bodyText)) !== null) {
          const p = parseInt(m[1].replace(/\./g, ""), 10);
          if (isValidPriceEur(p)) {
            priceEur = p;
            break; // PRIMERO, no MAX
          }
        }
      }

      // Título (para debug)
      let title: string | null = null;
      for (const d of jsonLd) {
        if (d && typeof d === "object" && "name" in d) {
          const n = (d as { name?: unknown }).name;
          if (typeof n === "string") { title = n; break; }
        }
      }
      if (!title) title = $("h1").first().text().trim() || null;

      return {
        kind: "ok",
        result: {
          portal: opts.portal,
          url,
          externalId: opts.externalIdFromUrl?.(url) ?? null,
          price: priceEur != null ? priceEur * 100 : null,
          status: "ACTIVE",
          title,
          observedAt: new Date(),
        },
      };
    },
  };
}
