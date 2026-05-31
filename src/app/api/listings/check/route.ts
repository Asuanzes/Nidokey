import { NextRequest, NextResponse } from "next/server";
import { checkAllActiveListings, checkListing } from "@/features/scraping/runner";
import { getUserId } from "@/lib/auth-helpers";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300; // hasta 5 min para batch grande

/**
 * POST /api/listings/check
 *   body: { listingId?: string }  → re-check de UNO concreto
 *   body: {} (o vacío)             → re-check de TODOS los activos
 *
 * Auth: usuario autenticado (botón de recheck en la web) O cron (CRON_SECRET).
 * Antes era público; ahora exige una de las dos credenciales.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await getUserId())) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { listingId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body vacío está OK
  }

  if (body.listingId) {
    const r = await checkListing(body.listingId);
    return NextResponse.json(r);
  }
  const summary = await checkAllActiveListings();
  return NextResponse.json(summary);
}
