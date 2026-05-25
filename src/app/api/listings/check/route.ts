import { NextRequest, NextResponse } from "next/server";
import { checkAllActiveListings, checkListing } from "@/features/scraping/runner";

export const maxDuration = 300; // hasta 5 min para batch grande

/**
 * POST /api/listings/check
 *   body: { listingId?: string }  → re-check de UNO concreto
 *   body: {} (o vacío)             → re-check de TODOS los activos
 */
export async function POST(req: NextRequest) {
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
