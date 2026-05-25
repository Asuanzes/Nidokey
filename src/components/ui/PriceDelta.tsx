import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** céntimos */
  from?: number | null;
  /** céntimos */
  to?: number | null;
  size?: "sm" | "md";
  showAbsolute?: boolean;
  className?: string;
};

export function PriceDelta({ from, to, size = "sm", showAbsolute = false, className }: Props) {
  if (from == null || to == null || from === 0) {
    return <span className={cn("inline-flex items-center text-text-subtle", className)}>—</span>;
  }
  const diff = to - from;
  const pct = (diff / from) * 100;
  const dir = diff === 0 ? "flat" : diff > 0 ? "up" : "down";

  const palette =
    dir === "up"
      ? "bg-price-up-bg text-price-up-fg"
      : dir === "down"
      ? "bg-price-down-bg text-price-down-fg"
      : "bg-surface-muted text-text-muted";

  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  const sizing = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  const abs = Math.abs(diff) / 100;
  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(abs);

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md font-medium tabular", palette, sizing, className)}>
      <Icon size={size === "sm" ? 11 : 13} />
      {Math.abs(pct).toFixed(1)}%
      {showAbsolute && <span className="text-text-muted/80">· {formatted}</span>}
    </span>
  );
}
