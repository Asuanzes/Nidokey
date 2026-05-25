import * as React from "react";
import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-xs", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-text-subtle">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-text tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}
