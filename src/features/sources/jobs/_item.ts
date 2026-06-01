import type { ApifyItem } from "@/features/sources/providers/apify";

/**
 * Lectores defensivos de items de Apify: cada actor nombra los campos a su
 * manera, así que probamos varias claves y devolvemos el primer valor válido.
 */

export function pickStr(item: ApifyItem, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

export function pickDate(item: ApifyItem, ...keys: string[]): Date | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
}
