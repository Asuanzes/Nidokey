import Link from "next/link";
import { Bed, MapPin, Maximize2 } from "lucide-react";
import { StatusBadge, Table, THead, TH, TR, TD, PriceDelta } from "@/components/ui";
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
  builtArea: number | null;
  media: { url: string }[];
  priceHistory: { price: number; observedAt: Date }[];
};

const TYPE_LABEL: Record<string, string> = {
  PISO: "Piso", HOUSE: "Casa", ATICO: "Ático", CHALET: "Chalet",
  DUPLEX: "Dúplex", ESTUDIO: "Estudio", LOFT: "Loft", LOCAL: "Local",
  TERRENO: "Terreno", OTRO: "Otro",
};

export function PropertyTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH className="w-[44%]">Inmueble</TH>
          <TH>Tipo</TH>
          <TH>Estado</TH>
          <TH className="text-right">Precio</TH>
          <TH className="text-right">Δ</TH>
          <TH className="text-right">Hab.</TH>
          <TH className="text-right">m²</TH>
          <TH className="w-20 text-right">Acciones</TH>
        </tr>
      </THead>
      <tbody>
        {rows.map((r) => {
          const prev = r.priceHistory.length >= 2 ? r.priceHistory[r.priceHistory.length - 2].price : null;
          const last = r.priceHistory.length >= 1 ? r.priceHistory[r.priceHistory.length - 1].price : r.currentPrice;
          return (
            <TR key={r.id}>
              <TD>
                <Link href={`/properties/${r.id}`} className="flex items-center gap-3">
                  {r.media[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.media[0].url} alt="" referrerPolicy="no-referrer" className="h-10 w-14 rounded-md border border-border object-cover" />
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-surface-muted text-text-subtle">
                      <Maximize2 size={12} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text group-hover:text-primary">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                      <MapPin size={11} />
                      {r.neighborhood ? `${r.neighborhood}, ${r.city}` : r.city}
                    </div>
                  </div>
                </Link>
              </TD>
              <TD className="text-text-muted">{TYPE_LABEL[r.type] ?? r.type}</TD>
              <TD><StatusBadge status={r.status} /></TD>
              <TD className="text-right text-sm font-semibold tabular">{formatPrice(r.currentPrice)}</TD>
              <TD className="text-right"><PriceDelta from={prev} to={last} /></TD>
              <TD className="text-right tabular text-text-muted">
                <span className="inline-flex items-center gap-1"><Bed size={11} />{r.rooms ?? "—"}</span>
              </TD>
              <TD className="text-right tabular text-text-muted">{r.builtArea ?? "—"}</TD>
              <TD className="text-right">
                <RowActionsMenu propertyId={r.id} propertyTitle={r.title} />
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
