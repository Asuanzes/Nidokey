import Link from "next/link";
import { Bath, Bed, MapPin, Maximize2 } from "lucide-react";
import { StatusBadge, PriceDelta } from "@/components/ui";
import { formatPrice } from "@buysell/shared";
import { RowActionsMenu } from "./RowActionsMenu";

type Row = {
  id: string;
  title: string;
  type: string;
  status: string;
  city: string;
  neighborhood: string | null;
  currentPrice: number | null;
  rooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  media: { url: string }[];
  priceHistory: { price: number; observedAt: Date }[];
};

export function PropertyCard({ p }: { p: Row }) {
  const prev = p.priceHistory.length >= 2 ? p.priceHistory[p.priceHistory.length - 2].price : null;
  const last = p.priceHistory.length >= 1 ? p.priceHistory[p.priceHistory.length - 1].price : p.currentPrice;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-shadow hover:shadow-sm">
      <Link href={`/properties/${p.id}`} className="block">
        <div className="relative aspect-[4/3] bg-surface-muted">
          {p.media[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.media[0].url} alt={p.title} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-text-subtle">Sin foto</div>
          )}
          <div className="absolute left-3 top-3">
            <StatusBadge status={p.status} />
          </div>
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-sm font-semibold text-text">{p.title}</h3>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <MapPin size={11} />
            {p.neighborhood ? `${p.neighborhood}, ${p.city}` : p.city}
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-lg font-semibold text-text tabular">{formatPrice(p.currentPrice)}</div>
            <PriceDelta from={prev} to={last} />
          </div>
          <div className="flex items-center gap-3 border-t border-border pt-2.5 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1"><Bed size={12} />{p.rooms ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Bath size={12} />{p.bathrooms ?? "—"}</span>
            <span className="inline-flex items-center gap-1"><Maximize2 size={12} />{p.builtArea ?? "—"} m²</span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <RowActionsMenu propertyId={p.id} propertyTitle={p.title} variant="card" />
      </div>
    </div>
  );
}
