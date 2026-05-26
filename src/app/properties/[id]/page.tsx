import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bath, Bed, Building2, Calendar, ExternalLink, Flame, Home, Layers,
  MapPin, Maximize2, Pencil, Ruler, Trees, Warehouse, Waves,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { formatPrice, formatDate } from "@buysell/shared";
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, PageHeader,
  PriceDelta, StatusBadge,
} from "@/components/ui";
import { Gallery } from "@/features/properties/Gallery";
import { PriceHistoryChart } from "@/features/properties/PriceHistoryChart";
import { CadastreCard } from "@/features/properties/CadastreCard";
import { ListingRecheck } from "@/features/properties/ListingRecheck";
import { SimilarPropertiesCard } from "@/features/properties/SimilarPropertiesCard";
import { SearchOtherPortalsButton } from "@/features/properties/SearchOtherPortalsButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  PISO: "Piso", HOUSE: "Casa", ATICO: "Ático", CHALET: "Chalet",
  DUPLEX: "Dúplex", ESTUDIO: "Estudio", LOFT: "Loft", LOCAL: "Local",
  TERRENO: "Terreno", OTRO: "Otro",
};

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

const FEATURES = [
  { key: "hasElevator", label: "Ascensor", icon: Layers },
  { key: "hasGarage", label: "Garaje", icon: Warehouse },
  { key: "hasStorage", label: "Trastero", icon: Warehouse },
  { key: "hasTerrace", label: "Terraza", icon: Trees },
  { key: "hasFireplace", label: "Chimenea", icon: Flame },
  { key: "hasGarden", label: "Jardín", icon: Trees },
  { key: "hasPool", label: "Piscina", icon: Waves },
] as const;

function mediaSourceLabel(s: string) {
  switch (s) {
    case "CADASTRE": return "Plano oficial (Catastro)";
    case "AI_SKETCH": return "Boceto estimado por IA";
    case "AI_RECONSTRUCTION": return "Reconstrucción IA";
    case "PORTAL_SCRAPE": return "Del portal";
    default: return "Subido por el usuario";
  }
}

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const p = await prisma.property.findFirst({
    where: { id, ownerId },
    include: {
      media: { orderBy: { order: "asc" } },
      listings: { orderBy: { createdAt: "desc" } },
      priceHistory: { orderBy: { observedAt: "asc" } },
    },
  });
  if (!p) notFound();

  const photos = p.media.filter((m) => m.kind === "PHOTO");
  const floorplans = p.media.filter((m) => m.kind === "FLOORPLAN");

  const prevPrice =
    p.priceHistory.length >= 2 ? p.priceHistory[p.priceHistory.length - 2].price : null;
  const firstPrice = p.priceHistory[0]?.price ?? null;

  return (
    <>
      <PageHeader
        title={p.title}
        description={
          [
            TYPE_LABEL[p.type] ?? p.type,
            p.neighborhood,
            p.city,
            p.province,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        actions={
          <>
            <Link href="/properties">
              <Button variant="ghost" size="sm">← Volver</Button>
            </Link>
            <SearchOtherPortalsButton
              title={p.title}
              city={p.city}
              rooms={p.rooms}
              builtArea={p.builtArea}
              mainPhotoUrl={photos[0]?.url ?? null}
              excludePortal={p.listings[0]?.portal ?? null}
            />
            <Link href={`/properties/${p.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={13} /> Editar
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Columna izquierda */}
        <div className="space-y-6 min-w-0">
          <Gallery photos={photos} />

          {p.description && (
            <Card>
              <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{p.description}</p>
              </CardBody>
            </Card>
          )}

          <SimilarPropertiesCard propertyId={p.id} />

          <Card>
            <CardHeader>
              <CardTitle>Histórico de precio</CardTitle>
              <PriceDelta from={firstPrice} to={p.currentPrice} showAbsolute />
            </CardHeader>
            <CardBody>
              <PriceHistoryChart data={p.priceHistory} />
            </CardBody>
          </Card>

          {p.environment && (
            <Card>
              <CardHeader><CardTitle>Entorno</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{p.environment}</p>
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {floorplans.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Planos</CardTitle></CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {floorplans.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" referrerPolicy="no-referrer" className="w-full" />
                      <div className="border-t border-border bg-surface-muted px-3 py-1.5 text-xs text-text-muted">
                        {mediaSourceLabel(m.source)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Columna derecha (aside) */}
        <aside className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                {p.priceHistory.length >= 2 && <PriceDelta from={prevPrice} to={p.currentPrice} />}
              </div>
              <div className="mt-3 text-3xl font-semibold text-accent tabular">{formatPrice(p.currentPrice)}</div>
              {p.builtArea && p.currentPrice && (
                <div className="mt-1 text-xs text-text-muted">
                  {Math.round((p.currentPrice / 100) / p.builtArea).toLocaleString("es-ES")} €/m²
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Características</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Spec icon={Home} label="Tipo" value={TYPE_LABEL[p.type]} />
                <Spec icon={Bed} label="Habitaciones" value={p.rooms ?? "—"} />
                <Spec icon={Bath} label="Baños" value={p.bathrooms ?? "—"} />
                <Spec icon={Maximize2} label="Construidos" value={p.builtArea ? `${p.builtArea} m²` : "—"} />
                <Spec icon={Ruler} label="Útiles" value={p.usableArea ? `${p.usableArea} m²` : "—"} />
                <Spec icon={Trees} label="Parcela" value={p.plotArea ? `${p.plotArea} m²` : "—"} />
                <Spec icon={Layers} label="Planta" value={p.floor ?? "—"} />
                <Spec icon={Calendar} label="Año" value={p.yearBuilt ?? "—"} />
              </dl>

              <div className="border-t border-border pt-3">
                <div className="mb-2 text-xs font-medium text-text-muted">Extras</div>
                <div className="flex flex-wrap gap-1.5">
                  {FEATURES.filter((f) => (p as unknown as Record<string, unknown>)[f.key]).map((f) => (
                    <Badge key={f.key} tone="primary">
                      <f.icon size={11} /> {f.label}
                    </Badge>
                  ))}
                  {FEATURES.every((f) => !(p as unknown as Record<string, unknown>)[f.key]) && (
                    <span className="text-xs text-text-subtle">Sin extras marcados</span>
                  )}
                </div>
              </div>

              {p.energyRating !== "UNKNOWN" && (
                <div className="border-t border-border pt-3 text-xs text-text-muted">
                  Certificación energética: <span className="font-medium text-text">{p.energyRating}</span>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ubicación</CardTitle></CardHeader>
            <CardBody className="space-y-1.5 text-sm">
              {p.address && (
                <div className="flex items-start gap-2 text-text">
                  <MapPin size={13} className="mt-0.5 text-text-subtle" />
                  <span>{p.address}</span>
                </div>
              )}
              <div className="text-text-muted">{p.neighborhood ? `${p.neighborhood}, ` : ""}{p.postalCode ? `${p.postalCode} ` : ""}{p.city}</div>
              <div className="text-text-muted">{p.province}, {p.country}</div>
              <CadastreCard
                propertyId={p.id}
                cadastralRef={p.cadastralRef}
                cadastralData={p.cadastralData}
                province={p.province}
                city={p.city}
                address={p.address}
              />
            </CardBody>
          </Card>

          {p.listings.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Anuncios vinculados</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                {p.listings.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0 space-y-1">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {PORTAL_LABEL[l.portal] ?? l.portal} <ExternalLink size={11} />
                      </a>
                      <div className="text-xs text-text-muted tabular">
                        {formatPrice(l.lastPrice)} · revisado {formatDate(l.lastCheckedAt)}
                      </div>
                      <ListingRecheck
                        listingId={l.id}
                        portal={l.portal}
                        url={l.url}
                        lastCheckedAt={l.lastCheckedAt}
                      />
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {p.notes && (
            <Card>
              <CardHeader><CardTitle>Notas privadas</CardTitle></CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{p.notes}</p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function Spec({
  icon: Icon, label, value,
}: { icon: typeof Bath; label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-text-muted">
        <Icon size={12} className="text-text-subtle" /> {label}
      </dt>
      <dd className="text-right font-medium text-text tabular">{value}</dd>
    </>
  );
}
