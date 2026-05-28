import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth-helpers";
import { pickAdapter } from "@/features/scraping/runner";
import { importListing } from "@/lib/import-listing";
import type { ImportListingPayload } from "@/lib/import-listing";
import type { ScrapeResult } from "@/features/scraping/types";

export const maxDuration = 30;

const Input = z.object({ url: z.string().url() });

function scrapeResultToPayload(result: ScrapeResult, url: string): ImportListingPayload {
  return {
    url,
    portal: result.portal,
    externalId: result.externalId,
    // Fallback: la URL pasa el min(2) de Zod si el título es nulo
    title: result.title?.trim() || url,
    // ScrapeResult.price está en céntimos; ImportListingPayload espera euros enteros
    price: result.price != null ? Math.round(result.price / 100) : undefined,
    images: [],
    features: [],
  };
}

export async function POST(req: NextRequest) {
  const ownerId = await getUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const { url } = parsed.data;
  const adapter = pickAdapter(url);

  if (!adapter) {
    return NextResponse.json(
      {
        error: "portal_unknown",
        message: "No se reconoce el portal. Puedes añadir el inmueble manualmente.",
      },
      { status: 422 }
    );
  }

  if (adapter.manualOnly) {
    return NextResponse.json(
      {
        error: "manual_only",
        portal: adapter.portal,
        message: `${adapter.portal} usa protección anti-bot que bloquea el scraping automático. Añade el inmueble manualmente.`,
      },
      { status: 422 }
    );
  }

  const outcome = await adapter.scrape(url);

  switch (outcome.kind) {
    case "gone":
      return NextResponse.json(
        { error: "gone", message: "El anuncio ya no existe en el portal." },
        { status: 410 }
      );
    case "blocked":
      return NextResponse.json(
        {
          error: "blocked",
          message: "El portal está bloqueando temporalmente el acceso. Inténtalo de nuevo en unos minutos.",
        },
        { status: 422 }
      );
    case "error":
      return NextResponse.json(
        { error: "scrape_error", message: outcome.error },
        { status: 502 }
      );
    case "ok": {
      const payload = scrapeResultToPayload(outcome.result, url);
      try {
        const result = await importListing(payload, { ownerId });
        return NextResponse.json(result, { status: result.created ? 201 : 200 });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al importar";
        return NextResponse.json({ error: "import_error", message: msg }, { status: 500 });
      }
    }
  }
}
