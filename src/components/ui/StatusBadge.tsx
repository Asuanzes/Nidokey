import { Badge } from "./Badge";

const map: Record<string, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  FOR_SALE:   { tone: "info",    label: "En venta" },
  RESERVED:   { tone: "warning", label: "Reservado" },
  SOLD:       { tone: "success", label: "Vendido" },
  WITHDRAWN:  { tone: "neutral", label: "Retirado" },
  ACTIVE:     { tone: "info",    label: "Activo" },
  PRICE_DROP: { tone: "success", label: "Bajada de precio" },
  PRICE_UP:   { tone: "danger",  label: "Subida de precio" },
  REMOVED:    { tone: "neutral", label: "Retirado" },
  UNKNOWN:    { tone: "neutral", label: "Desconocido" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={cfg.tone} dot>{cfg.label}</Badge>;
}
