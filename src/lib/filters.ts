import type { Prisma } from "@prisma/client";

export type PropertyFilters = {
  q?: string;
  city?: string;
  province?: string;
  type?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  hasFireplace?: boolean;
  hasGarage?: boolean;
  hasTerrace?: boolean;
};

export function buildPropertyWhere(f: PropertyFilters): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};
  if (f.q) {
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
      { neighborhood: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.city) where.city = { equals: f.city, mode: "insensitive" };
  if (f.province) where.province = { equals: f.province, mode: "insensitive" };
  if (f.type) where.type = f.type as Prisma.PropertyWhereInput["type"];
  if (f.status) where.status = f.status as Prisma.PropertyWhereInput["status"];
  if (f.minPrice != null || f.maxPrice != null) {
    where.currentPrice = {
      ...(f.minPrice != null ? { gte: f.minPrice } : {}),
      ...(f.maxPrice != null ? { lte: f.maxPrice } : {}),
    };
  }
  if (f.minRooms != null) where.rooms = { gte: f.minRooms };
  if (f.hasFireplace) where.hasFireplace = true;
  if (f.hasGarage) where.hasGarage = true;
  if (f.hasTerrace) where.hasTerrace = true;
  return where;
}

export function parseFilters(sp: URLSearchParams): PropertyFilters {
  const num = (k: string) => {
    const v = sp.get(k);
    return v == null || v === "" ? undefined : Number(v);
  };
  const bool = (k: string) => sp.get(k) === "true";
  return {
    q: sp.get("q") ?? undefined,
    city: sp.get("city") ?? undefined,
    province: sp.get("province") ?? undefined,
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    minRooms: num("minRooms"),
    hasFireplace: bool("hasFireplace"),
    hasGarage: bool("hasGarage"),
    hasTerrace: bool("hasTerrace"),
  };
}
