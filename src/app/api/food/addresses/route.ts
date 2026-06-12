import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { geocodeAddress } from "@/lib/geocode";

const AddressBody = z.object({
  label: z.string().min(1).max(40),
  line: z.string().min(4).max(180),
  city: z.string().min(2).max(80),
  postalCode: z.string().max(20).optional().nullable(),
  notes: z.string().max(280).optional().nullable(),
  isDefault: z.boolean().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

function coordsFromBody(data: {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}): { latitude: number; longitude: number } | null {
  const latitude = data.latitude ?? data.lat;
  const longitude = data.longitude ?? data.lng;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export async function GET() {
  const userId = await requireUserId();
  const addresses = await prisma.foodAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ addresses });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  const json = await req.json().catch(() => null);
  const parsed = AddressBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body invalido", detail: parsed.error.flatten() }, { status: 400 });
  }
  const geo =
    coordsFromBody(parsed.data) ??
    (await geocodeAddress({
      address: parsed.data.line,
      city: parsed.data.city,
      postalCode: parsed.data.postalCode,
      country: "Espana",
    }));
  if (!geo) return NextResponse.json({ error: "No se pudo geocodificar la direccion" }, { status: 400 });
  const address = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.foodAddress.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.foodAddress.create({
      data: {
        userId,
        label: parsed.data.label,
        line: parsed.data.line,
        city: parsed.data.city,
        postalCode: parsed.data.postalCode ?? null,
        notes: parsed.data.notes ?? null,
        isDefault: parsed.data.isDefault ?? false,
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    });
  });
  return NextResponse.json({ address }, { status: 201 });
}

const PatchBody = AddressBody.partial().extend({ id: z.string().min(1) });

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body invalido", detail: parsed.error.flatten() }, { status: 400 });
  }
  const current = await prisma.foodAddress.findFirst({ where: { id: parsed.data.id, userId } });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const bodyCoords = coordsFromBody(parsed.data);
  const needsGeo = Boolean(parsed.data.line || parsed.data.city || parsed.data.postalCode !== undefined || bodyCoords);
  const geo =
    bodyCoords ??
    (needsGeo
      ? await geocodeAddress({
          address: parsed.data.line ?? current.line,
          city: parsed.data.city ?? current.city,
          postalCode: parsed.data.postalCode ?? current.postalCode,
          country: "Espana",
        })
      : null);
  if (needsGeo && !geo) return NextResponse.json({ error: "No se pudo geocodificar la direccion" }, { status: 400 });
  const address = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) await tx.foodAddress.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.foodAddress.update({
      where: { id: current.id },
      data: {
        label: parsed.data.label,
        line: parsed.data.line,
        city: parsed.data.city,
        postalCode: parsed.data.postalCode,
        notes: parsed.data.notes,
        isDefault: parsed.data.isDefault,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      },
    });
  });
  return NextResponse.json({ address });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  const deleted = await prisma.foodAddress.deleteMany({ where: { id, userId } });
  if (deleted.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
