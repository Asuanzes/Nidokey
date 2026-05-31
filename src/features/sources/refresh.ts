import { prisma } from "@/lib/db";
import type { RecordType } from "@nidokey/shared";
import { marketData, type CoinMarket } from "@/features/sources/adapters/coingecko";
import { logImportEvent } from "@/lib/import-log";

/**
 * Refresh por tipo. Generaliza checkAllActiveListings: actualiza el valor de
 * los registros y escribe un *Snapshot solo si cambia.
 *
 * Cripto/mercados usan BATCH (una llamada cubre todas las posiciones) → cabe en
 * los ~60 s de Vercel Hobby y no agota la free tier. Los tipos de scraping
 * (property/renting…) se ejecutarán vía GitHub Actions en fases posteriores.
 */
export type RefreshSummary = {
  type: RecordType;
  checked: number;
  updated: number;
  errors: number;
};

export async function refreshType(type: RecordType): Promise<RefreshSummary> {
  if (type === "crypto") return refreshCrypto();
  return { type, checked: 0, updated: 0, errors: 0 };
}

async function refreshCrypto(): Promise<RefreshSummary> {
  const holdings = await prisma.cryptoHolding.findMany({
    where: { source: "coingecko", externalId: { not: null } },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
  });
  if (holdings.length === 0) {
    return { type: "crypto", checked: 0, updated: 0, errors: 0 };
  }

  // Agrupar por moneda de cotización → una llamada batch por grupo.
  const byQuote = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const q = (h.quoteCurrency || "EUR").toUpperCase();
    const arr = byQuote.get(q);
    if (arr) arr.push(h);
    else byQuote.set(q, [h]);
  }

  let checked = 0;
  let updated = 0;
  let errors = 0;
  const now = new Date();

  for (const [quote, group] of byQuote) {
    const ids = [...new Set(group.map((h) => h.externalId!).filter(Boolean))];
    let md: Record<string, CoinMarket> = {};
    try {
      md = await marketData(ids, quote);
    } catch {
      errors += group.length;
      continue;
    }
    for (const h of group) {
      checked++;
      const m = md[h.externalId!];
      if (!m) continue;
      const cents = m.priceCents;
      const changed = cents !== h.currentValue;
      await prisma.cryptoHolding.update({
        where: { id: h.id },
        data: {
          currentValue: cents,
          lastCheckedAt: now,
          // refresca siempre %24h/volumen/sparkline (cambian aunque el precio no)
          meta: {
            ...((h.meta as Record<string, unknown>) ?? {}),
            change24h: m.change24h,
            volume: m.volume,
            marketCap: m.marketCap,
            sparkline: m.sparkline,
          },
          ...(changed
            ? { snapshots: { create: [{ value: cents, source: "coingecko", observedAt: now }] } }
            : {}),
        },
      });
      if (changed) updated++;
    }
  }

  const summary = { type: "crypto" as const, checked, updated, errors };
  await logImportEvent("RECHECK", {
    ok: errors === 0,
    message: `crypto refresh: ${updated}/${checked} actualizados`,
    meta: summary,
  });
  return summary;
}
