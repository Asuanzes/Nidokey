import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStaffOrNull, staffCanManageMenu } from "@/lib/food/guard";

const CategoryBody = z.object({ kind: z.literal("category"), name: z.string().min(1).max(80), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
const ItemBody = z.object({
  kind: z.literal("item"),
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  available: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});
const Body = z.union([CategoryBody, ItemBody]);
const PatchBody = z.object({
  kind: z.enum(["category", "item"]),
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  priceCents: z.number().int().nonnegative().optional(),
  available: z.boolean().optional(),
  active: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  categoryId: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const staff = await getStaffOrNull(userId, id);
  if (!staff || !staffCanManageMenu(staff.role)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.kind === "category") {
    const category = await prisma.menuCategory.create({
      data: { restaurantId: id, name: parsed.data.name, sortOrder: parsed.data.sortOrder ?? 0, active: parsed.data.active ?? true },
    });
    return NextResponse.json({ category }, { status: 201 });
  }
  const item = await prisma.menuItem.create({
    data: {
      restaurantId: id,
      categoryId: parsed.data.categoryId ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      priceCents: parsed.data.priceCents,
      available: parsed.data.available ?? true,
      allergens: parsed.data.allergens ?? [],
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const staff = await getStaffOrNull(userId, id);
  if (!staff || !staffCanManageMenu(staff.role)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body inválido", detail: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.kind === "category") {
    const existing = await prisma.menuCategory.findFirst({ where: { id: parsed.data.id, restaurantId: id } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const category = await prisma.menuCategory.update({
      where: { id: existing.id },
      data: { name: parsed.data.name, active: parsed.data.active, sortOrder: parsed.data.sortOrder },
    });
    return NextResponse.json({ category });
  }
  const existing = await prisma.menuItem.findFirst({ where: { id: parsed.data.id, restaurantId: id } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const item = await prisma.menuItem.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      priceCents: parsed.data.priceCents,
      available: parsed.data.available,
      allergens: parsed.data.allergens,
      sortOrder: parsed.data.sortOrder,
      categoryId: parsed.data.categoryId,
    },
  });
  return NextResponse.json({ item });
}
