import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildPropertyWhere, parseFilters } from "@/lib/filters";
import { requireUserId } from "@/lib/auth-helpers";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { PropertyTable } from "@/features/properties/PropertyTable";
import { PropertyCard } from "@/features/properties/PropertyCard";
import { FiltersSidebar } from "@/features/properties/FiltersSidebar";
import { ViewToggle } from "@/features/properties/ViewToggle";
import { SortMenu } from "@/features/properties/SortMenu";

export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };

function spToUsp(sp: SP): URLSearchParams {
  return new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v == null ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v]]
    )
  );
}

function parseSort(s: string | undefined): Prisma.PropertyOrderByWithRelationInput {
  switch (s) {
    case "createdAt-desc": return { createdAt: "desc" };
    case "currentPrice-asc": return { currentPrice: "asc" };
    case "currentPrice-desc": return { currentPrice: "desc" };
    case "updatedAt-desc":
    default: return { updatedAt: "desc" };
  }
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const usp = spToUsp(sp);
  const ownerId = await requireUserId();
  const filters = parseFilters(usp);
  const where = { ...buildPropertyWhere(filters), ownerId };
  const sort = typeof sp.sort === "string" ? sp.sort : "updatedAt-desc";
  const view: "table" | "grid" = sp.view === "grid" ? "grid" : "table";

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: parseSort(sort),
      include: {
        media: { take: 1, orderBy: { order: "asc" } },
        priceHistory: { orderBy: { observedAt: "asc" } },
      },
      take: 100,
    }),
    prisma.property.count({ where }),
  ]);

  const initial: Record<string, string | undefined> = {
    city: filters.city,
    type: filters.type,
    status: filters.status,
    minPrice: filters.minPrice?.toString(),
    maxPrice: filters.maxPrice?.toString(),
    minRooms: filters.minRooms?.toString(),
    hasFireplace: filters.hasFireplace ? "true" : undefined,
    hasGarage: filters.hasGarage ? "true" : undefined,
    hasTerrace: filters.hasTerrace ? "true" : undefined,
  };

  return (
    <>
      <PageHeader
        title="Inmuebles"
        description={`${total} ${total === 1 ? "ficha" : "fichas"} registradas`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Ordenar por</span>
              <SortMenu value={sort} />
            </div>
            <ViewToggle view={view} />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<Building2 size={28} />}
              title="No hay inmuebles que coincidan"
              description="Prueba a ajustar o limpiar los filtros, o crea una nueva ficha."
              action={
                <Link href="/properties/new">
                  <Button variant="primary"><Plus size={14} />Nuevo inmueble</Button>
                </Link>
              }
            />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((p) => <PropertyCard key={p.id} p={p} />)}
            </div>
          ) : (
            <PropertyTable rows={rows} />
          )}
        </div>

        <FiltersSidebar initial={initial} className="self-start lg:sticky lg:top-6" />
      </div>
    </>
  );
}
