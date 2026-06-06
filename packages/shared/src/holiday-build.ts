/**
 * Construcción del payload de un VIAJE (record `holiday`) listo para
 * POST /api/records/import { input.kind:"record" }. Centraliza el cálculo del
 * total y de la COMISIÓN para que móvil y backend coincidan.
 *
 * ⚠️ COMISIÓN INTERNA: `estimateCommission` se guarda en `meta.commission` SOLO
 * para contabilidad nuestra. NUNCA debe mostrarse al usuario ni colarse en
 * `title`/`subtitle`/`currentValue`. El total visible = transporte + alojamiento.
 */
import {
  type TransportLeg,
  type AccommodationChoice,
  type HolidayTripMeta,
  holidayTotalCents,
  estimateCommission,
} from "./holiday";

/** Payload normalizado de holiday para el import unificado de records. */
export interface HolidayImportRecord {
  recordType: "holiday";
  title: string;
  subtitle: string | null;
  status: string;
  currentValue: number; // total en céntimos (lo que ve el usuario)
  currency: string;
  imageUrl: string | null;
  source: string;
  externalId: string;
  meta: HolidayTripMeta & Record<string, unknown>;
}

export function buildHolidayImport(args: {
  destination: string;
  startISO: string;
  endISO: string;
  transport?: TransportLeg | null;
  accommodation?: AccommodationChoice | null;
  imageUrl?: string | null;
  /** Tasa de comisión interna (0–1). Por defecto 6%. */
  commissionRate?: number;
}): HolidayImportRecord {
  const total = holidayTotalCents(args.transport, args.accommodation);
  // COMISIÓN: interna. Se guarda en meta.commission y NUNCA se muestra al usuario.
  const commission = estimateCommission(total, args.commissionRate ?? 0.06);
  const currency = args.accommodation?.currency ?? args.transport?.currency ?? "EUR";
  return {
    recordType: "holiday",
    title: `Viaje a ${args.destination}`,
    subtitle: `${args.startISO} – ${args.endISO}`,
    status: "PLANNING",
    currentValue: total, // total visible; sin desglose de comisión
    currency,
    imageUrl: args.imageUrl ?? args.accommodation?.imageUrls?.thumbnail ?? null,
    source: "nidokey-wizard",
    externalId: `${args.destination}|${args.startISO}|${args.endISO}`.toLowerCase(),
    meta: {
      destination: args.destination,
      startISO: args.startISO,
      endISO: args.endISO,
      transport: args.transport ?? null,
      accommodation: args.accommodation ?? null,
      totalCents: total,
      currency,
      commission, // 👈 INTERNO. No leer en ninguna UI de usuario.
    },
  };
}
