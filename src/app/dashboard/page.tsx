import Link from "next/link";
import { Building2, RefreshCw, Sparkles, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
} from "@/components/ui";
import { formatPrice } from "@nidokey/shared";
import { requireUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const STALE_DAYS = 7;
const MANUAL_PORTALS = ["IDEALISTA", "MILANUNCIOS"];

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

export default async function DashboardPage() {
  const ownerId = await requireUserId();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 24 * 1000);
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalActive,
    totalSold,
    totalWithdrawn,
    listingsByPortal,
    priceChanges30d,
    pendingMatches,
    listingsStale,
    blockedListings,
    propsMissingPhash,
    avgPricePerSqmByCity,
  ] = await Promise.all([
    prisma.property.count({ where: { ownerId, status: "FOR_SALE" } }),
    prisma.property.count({ where: { ownerId, status: "SOLD" } }),
    prisma.property.count({ where: { ownerId, status: "WITHDRAWN" } }),
    prisma.listing.groupBy({
      by: ["portal"],
      where: { property: { ownerId } },
      _count: { _all: true },
    }),
    prisma.priceSnapshot.count({
      where: { observedAt: { gte: since30 }, property: { ownerId } },
    }),
    // Matches del owner: filtramos por sourceId IN (ids del usuario).
    (async () => {
      const myIds = await prisma.property.findMany({
        where: { ownerId },
        select: { id: true },
      });
      if (myIds.length === 0) return 0;
      return prisma.matchSuggestion.count({
        where: {
          dismissedAt: null,
          score: { gte: 60 },
          sourceId: { in: myIds.map((p) => p.id) },
        },
      });
    })(),
    prisma.listing.count({
      where: {
        property: { ownerId },
        status: { in: ["ACTIVE", "PRICE_DROP", "PRICE_UP", "UNKNOWN"] },
        portal: { notIn: MANUAL_PORTALS as never },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleCutoff } }],
      },
    }),
    prisma.listing.count({
      where: {
        property: { ownerId },
        status: { in: ["ACTIVE", "PRICE_DROP", "PRICE_UP", "UNKNOWN"] },
        portal: { in: MANUAL_PORTALS as never },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleCutoff } }],
      },
    }),
    prisma.media.count({
      where: { kind: "PHOTO", phash: null, property: { ownerId } },
    }),
    prisma.$queryRaw<Array<{ city: string; avg: number; count: number }>>`
      SELECT city,
             ROUND(AVG("currentPrice"::float / NULLIF("builtArea", 0))::numeric / 100, 0)::int AS avg,
             COUNT(*)::int AS count
      FROM "Property"
      WHERE "ownerId" = ${ownerId}
        AND "currentPrice" IS NOT NULL
        AND "builtArea" IS NOT NULL
        AND "builtArea" > 0
        AND status = 'FOR_SALE'
      GROUP BY city
      HAVING COUNT(*) >= 2
      ORDER BY count DESC
      LIMIT 8
    `,
  ]);

  const totalListings = listingsByPortal.reduce((s, p) => s + p._count._all, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visión general de inmuebles, portales y matching"
      />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="En venta" value={totalActive} />
        <Stat label="Vendidos" value={totalSold} />
        <Stat label="Retirados" value={totalWithdrawn} />
        <Stat label="Listings" value={totalListings} hint={`en ${listingsByPortal.length} portales`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Distribución por portal */}
        <Card>
          <CardHeader>
            <CardTitle>Por portal</CardTitle>
          </CardHeader>
          <CardBody>
            {listingsByPortal.length === 0 ? (
              <div className="text-sm text-text-muted">Sin listings aún</div>
            ) : (
              <div className="space-y-2">
                {listingsByPortal
                  .sort((a, b) => b._count._all - a._count._all)
                  .map((p) => {
                    const pct = totalListings ? (p._count._all / totalListings) * 100 : 0;
                    return (
                      <div key={p.portal} className="space-y-0.5">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-text">{PORTAL_LABEL[p.portal] ?? p.portal}</span>
                          <span className="tabular text-text-muted">{p._count._all}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* €/m² medio por ciudad */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>€/m² medio por ciudad</CardTitle>
            <span className="text-xs text-text-muted">Top 8 con ≥ 2 fichas</span>
          </CardHeader>
          <CardBody>
            {avgPricePerSqmByCity.length === 0 ? (
              <div className="text-sm text-text-muted">Insuficientes datos todavía</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {avgPricePerSqmByCity.map((r) => (
                  <div key={r.city} className="rounded-md border border-border bg-surface-muted p-2.5">
                    <div className="line-clamp-1 text-xs text-text-muted">{r.city}</div>
                    <div className="text-lg font-semibold text-text tabular">
                      {r.avg.toLocaleString("es-ES")} €/m²
                    </div>
                    <div className="text-[10px] text-text-subtle tabular">{r.count} fichas</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Sección "Necesita atención" */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <AlertTriangle size={14} className="mr-1 inline text-warning" />
              Necesita atención
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm">
              <AttentionRow
                icon={<RefreshCw size={13} />}
                label="Listings sin re-check >7 días (auto)"
                count={listingsStale}
                hint={listingsStale > 0 ? "Ejecuta npm run check-listings" : null}
              />
              <AttentionRow
                icon={<RefreshCw size={13} />}
                label="Listings sin re-check >7 días (manual)"
                count={blockedListings}
                hint={blockedListings > 0 ? "Idealista/Milanuncios — abre cada anuncio y usa el userscript" : null}
              />
              <AttentionRow
                icon={<Sparkles size={13} />}
                label="Duplicados pendientes de revisar"
                count={pendingMatches}
                href="/matches"
              />
              <AttentionRow
                icon={<ImageIcon size={13} />}
                label="Fotos sin foto-hash"
                count={propsMissingPhash}
                hint={propsMissingPhash > 0 ? "Ejecuta npm run hash-photos" : null}
              />
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente (30 d)</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-semibold text-text tabular">{priceChanges30d}</div>
            <div className="mt-1 text-xs text-text-muted">
              snapshots de precio registrados en los últimos 30 días
            </div>
            <div className="mt-3">
              <Link href="/activity" className="text-xs text-primary hover:underline">
                Ver actividad detallada →
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function AttentionRow({
  icon,
  label,
  count,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  hint?: string | null;
  href?: string;
}) {
  const content = (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-text-subtle">{icon}</span>
        <div className="min-w-0">
          <div className="line-clamp-1 text-sm text-text">{label}</div>
          {hint && <div className="line-clamp-1 text-[11px] text-text-subtle">{hint}</div>}
        </div>
      </div>
      <Badge tone={count > 0 ? "warning" : "neutral"}>{count}</Badge>
    </li>
  );
  return href && count > 0 ? <Link href={href}>{content}</Link> : content;
}
