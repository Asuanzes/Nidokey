import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { enrichProperty } from "@/features/cadastre/lookup";

type Ctx = { params: Promise<{ id: string }> };

const OverrideSchema = z.object({
  latitude: z.coerce.number().gte(-90).lte(90).optional(),
  longitude: z.coerce.number().gte(-180).lte(180).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
}).partial();

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { requireUserId } = await import("@/lib/auth-helpers");
  const ownerId = await requireUserId();
  const property = await prisma.property.findFirst({ where: { id, ownerId } });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // El cliente puede mandar overrides manuales para retry con datos corregidos
  let override: z.infer<typeof OverrideSchema> = {};
  try {
    const body = await req.json();
    const parsed = OverrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Override inválido", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    override = parsed.data;
  } catch {
    /* body vacío = usar datos de la ficha */
  }

  const result = await enrichProperty({
    latitude: override.latitude ?? property.latitude,
    longitude: override.longitude ?? property.longitude,
    province: override.province ?? property.province,
    city: override.city ?? property.city,
    address: override.address ?? property.address,
  });

  // Si el usuario pasó coords/address manuales, también guardarlos en la ficha
  const userPatch: Record<string, unknown> = {};
  if (override.latitude != null && property.latitude == null) userPatch.latitude = override.latitude;
  if (override.longitude != null && property.longitude == null) userPatch.longitude = override.longitude;
  if (override.address && !property.address) userPatch.address = override.address;
  if (Object.keys(userPatch).length) {
    await prisma.property.update({ where: { id }, data: userPatch });
  }

  if (!result.ref) {
    return NextResponse.json(
      {
        ok: false,
        warnings: result.warnings,
        message: "No se pudo localizar en Catastro",
      },
      { status: 404 }
    );
  }

  // Rellena solo campos vacíos (no pisa lo que ya hay)
  const patch: Record<string, unknown> = {
    cadastralRef: result.ref,
    cadastralData: result.info as unknown as Record<string, unknown>,
  };
  if (result.info?.yearBuilt && !property.yearBuilt) patch.yearBuilt = result.info.yearBuilt;
  if (result.info?.builtArea && !property.builtArea) patch.builtArea = result.info.builtArea;
  if (result.info?.address && !property.address) patch.address = result.info.address;

  await prisma.property.update({
    where: { id },
    data: patch,
  });

  // Si Catastro tiene plano, añadirlo como Media (si no existía)
  if (result.info?.hasFloorplan && result.info.floorplanUrl) {
    const exists = await prisma.media.findFirst({
      where: { propertyId: id, source: "CADASTRE", kind: "FLOORPLAN" },
    });
    if (!exists) {
      await prisma.media.create({
        data: {
          propertyId: id,
          kind: "FLOORPLAN",
          source: "CADASTRE",
          url: result.info.floorplanUrl,
          caption: "Plano catastral",
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ref: result.ref,
    method: result.method,
    info: result.info,
    warnings: result.warnings,
  });
}
