import Link from "next/link";
import { Activity as ActivityIcon, ArrowDown, ArrowUp, CheckCircle2, Minus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge, Card, CardBody, EmptyState, PageHeader, Stat } from "@/components/ui";
import { formatPrice } from "@buysell/shared";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", OTHER: "Otro", MANUAL: "Manual",
};

type Direction = "up" | "down" | "flat" | "sold";

function classify(prev: number | null, cur: number, status: string | null): Direction {
  if (status === "SOLD") return "sold";
  if (prev == null) return "flat";
  if (cur > prev) return "up";
  if (cur < prev) return "down";
  return "flat";
}

const styles: Record<Direction, { wrap: string; icon: React.ReactNode; label: string }> = {
  up:   { wrap: "bg-price-up-bg text-price-up-fg", icon: <ArrowUp size={13} />, label: "Subida de precio" },
  down: { wrap: "bg-price-down-bg text-price-down-fg", icon: <ArrowDown size={13} />, label: "Bajada de precio" },
  flat: { wrap: "bg-surface-muted text-text-muted", icon: <Minus size={13} />, label: "Sin cambio" },
  sold: { wrap: "bg-success-soft text-success", icon: <CheckCircle2 size={13} />, label: "Marcado como vendido" },
};

function formatRelative(d: Date) {
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default async function ActivityPage() {
  const snapshots = await prisma.priceSnapshot.findMany({
    orderBy: { observedAt: "desc" },
    take: 100,
    include: { property: { select: { id: true, title: true, city: true } } },
  });

  // Adjuntar el precio previo de cada property para detectar dirección
  const byProperty = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const arr = byProperty.get(s.propertyId) ?? [];
    arr.push(s);
    byProperty.set(s.propertyId, arr);
  }

  // KPIs últimos 30 días
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000);
  const recent = snapshots.filter((s) => s.observedAt >= thirtyAgo);
  const ups = recent.filter((s, i, arr) => {
    const prev = arr.slice(i + 1).find((x) => x.propertyId === s.propertyId)?.price;
    return prev != null && s.price > prev;
  }).length;
  const downs = recent.filter((s, i, arr) => {
    const prev = arr.slice(i + 1).find((x) => x.propertyId === s.propertyId)?.price;
    return prev != null && s.price < prev;
  }).length;
  const solds = recent.filter((s) => s.status === "SOLD").length;

  // Group by day
  const byDay = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const key = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(s.observedAt);
    const arr = byDay.get(key) ?? [];
    arr.push(s);
    byDay.set(key, arr);
  }

  return (
    <>
      <PageHeader
        title="Actividad"
        description="Cambios de precio, transiciones de estado y eventos de scraping."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Bajadas (30d)" value={downs} hint="Inmuebles con precio reducido" />
        <Stat label="Subidas (30d)" value={ups} hint="Inmuebles con precio aumentado" />
        <Stat label="Vendidos (30d)" value={solds} hint="Anuncios marcados vendidos" />
      </div>

      <div className="mt-6">
        {snapshots.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon size={28} />}
            title="Sin actividad todavía"
            description="Cuando se registren cambios de precio o de estado, aparecerán aquí en una línea temporal."
          />
        ) : (
          <div className="space-y-8">
            {[...byDay.entries()].map(([day, events]) => (
              <section key={day}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-subtle">{day}</h2>
                <Card>
                  <CardBody className="p-0">
                    <ul className="divide-y divide-border">
                      {events.map((s) => {
                        const all = byProperty.get(s.propertyId) ?? [];
                        const idx = all.findIndex((x) => x.id === s.id);
                        const prev = all[idx + 1]?.price ?? null;
                        const dir = classify(prev, s.price, s.status);
                        const cfg = styles[dir];
                        return (
                          <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", cfg.wrap)}>
                              {cfg.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                                <Link href={`/properties/${s.property.id}`} className="font-medium text-text hover:text-primary">
                                  {s.property.title}
                                </Link>
                                <span className="text-xs text-text-subtle">· {s.property.city}</span>
                              </div>
                              <div className="mt-0.5 text-xs text-text-muted">
                                {cfg.label}
                                {prev != null && (
                                  <>
                                    {" — "}
                                    <span className="tabular">{formatPrice(prev)}</span>{" → "}
                                    <span className="tabular font-medium text-text">{formatPrice(s.price)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge tone="neutral">{PORTAL_LABEL[s.source] ?? s.source}</Badge>
                              <span className="w-20 text-right text-xs text-text-subtle tabular">{formatRelative(s.observedAt)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardBody>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
