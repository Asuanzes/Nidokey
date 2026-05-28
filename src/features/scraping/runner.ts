import { prisma } from "@/lib/db";
import { isReasonablePriceChange } from "@nidokey/shared";
import { logImportEvent } from "@/lib/import-log";
import type { PortalAdapter, ScrapeOutcome } from "./types";
import { idealistaAdapter } from "./adapters/idealista";
import { fotocasaAdapter } from "./adapters/fotocasa";
import { pisosAdapter } from "./adapters/pisos";
import { milanunciosAdapter } from "./adapters/milanuncios";
import { habitacliaAdapter } from "./adapters/habitaclia";
import { yaencontreAdapter } from "./adapters/yaencontre";
import { thinkspainAdapter } from "./adapters/thinkspain";
import { indomioAdapter } from "./adapters/indomio";

const ADAPTERS: PortalAdapter[] = [
  idealistaAdapter,
  fotocasaAdapter,
  pisosAdapter,
  milanunciosAdapter,
  habitacliaAdapter,
  yaencontreAdapter,
  thinkspainAdapter,
  indomioAdapter,
];

export function pickAdapter(url: string): PortalAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}

export type CheckSummary = {
  listingId: string;
  outcome: ScrapeOutcome["kind"];
  detail?: string;
  priceChanged?: boolean;
  previousPrice?: number | null;
  newPrice?: number | null;
};

/**
 * Re-check de un listing. Aplica los cambios a BBDD según outcome:
 *  - ok: actualiza precio + estado (PRICE_DROP/UP/ACTIVE) + lastCheckedAt + snapshot.
 *  - gone: marca como SOLD/REMOVED (no podemos distinguir).
 *  - blocked / error: solo actualiza lastCheckedAt para que sepamos que se intentó.
 */
export async function checkListing(listingId: string): Promise<CheckSummary> {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error(`Listing ${listingId} no encontrado`);

  const adapter = pickAdapter(listing.url);
  if (!adapter) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastCheckedAt: new Date() },
    });
    return { listingId, outcome: "error", detail: "Sin adaptador" };
  }

  if (adapter.manualOnly) {
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastCheckedAt: new Date() },
    });
    return {
      listingId,
      outcome: "blocked",
      detail: "Manual-only (anti-bot)",
    };
  }

  // Pasamos el precio anterior al adaptador para que pueda filtrar candidatos
  // fuera de rango (banners, anuncios relacionados…).
  const outcome = await adapter.scrape(listing.url, {
    previousPriceCents: listing.lastPrice,
  });

  // GONE
  if (outcome.kind === "gone") {
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "REMOVED", lastCheckedAt: new Date() },
    });
    return { listingId, outcome: "gone", detail: outcome.reason };
  }
  // BLOCKED / ERROR — solo touch
  if (outcome.kind !== "ok") {
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastCheckedAt: new Date() },
    });
    return {
      listingId,
      outcome: outcome.kind,
      detail: outcome.kind === "blocked" ? outcome.reason : outcome.error,
    };
  }

  // OK — validamos primero que el cambio sea razonable
  const r = outcome.result;
  const previousPrice = listing.lastPrice;
  const sanity = isReasonablePriceChange(previousPrice, r.price);
  if (!sanity.ok) {
    // Cambio sospechoso → NO actualizamos lastPrice ni creamos snapshot;
    // solo registramos el evento para revisión.
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastCheckedAt: new Date() },
    });
    await logImportEvent("RECHECK", {
      propertyId: listing.propertyId,
      ok: false,
      message: `Re-check rechazado: ${sanity.reason}`,
      meta: { listingId, scrapedPrice: r.price, previousPrice, portal: r.portal, url: listing.url },
    });
    return {
      listingId,
      outcome: "error",
      detail: sanity.reason,
      previousPrice,
      newPrice: r.price ?? null,
    };
  }

  const newPrice = r.price ?? previousPrice;
  const priceChanged = r.price != null && r.price !== previousPrice;
  const newStatus = priceChanged
    ? r.price! < (previousPrice ?? Infinity)
      ? "PRICE_DROP"
      : "PRICE_UP"
    : r.status;

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: newStatus,
      lastPrice: newPrice,
      lastSeenAt: r.observedAt,
      lastCheckedAt: new Date(),
    },
  });
  if (priceChanged && r.price != null) {
    await prisma.priceSnapshot.create({
      data: {
        listingId: listing.id,
        propertyId: listing.propertyId,
        price: r.price,
        status: newStatus,
        source: r.portal,
        observedAt: r.observedAt,
      },
    });
    await prisma.property.update({
      where: { id: listing.propertyId },
      data: { currentPrice: r.price },
    });
  }

  return {
    listingId,
    outcome: "ok",
    priceChanged,
    previousPrice,
    newPrice,
  };
}

/**
 * Recorre todos los listings activos (ACTIVE, PRICE_DROP, PRICE_UP, UNKNOWN)
 * y los re-comprueba. Devuelve un resumen agregado.
 */
export async function checkAllActiveListings(opts?: {
  onProgress?: (idx: number, total: number, summary: CheckSummary) => void;
}): Promise<{ total: number; results: CheckSummary[] }> {
  const listings = await prisma.listing.findMany({
    where: { status: { in: ["ACTIVE", "PRICE_DROP", "PRICE_UP", "UNKNOWN"] } },
    select: { id: true },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
  });
  const results: CheckSummary[] = [];
  let i = 0;
  for (const { id } of listings) {
    let summary: CheckSummary;
    try {
      summary = await checkListing(id);
    } catch (err) {
      summary = { listingId: id, outcome: "error", detail: (err as Error).message };
    }
    results.push(summary);
    i++;
    opts?.onProgress?.(i, listings.length, summary);
    // Pequeña pausa para no martillear los portales
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { total: listings.length, results };
}
