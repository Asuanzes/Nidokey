"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/cn";

export function ViewToggle({ view }: { view: "table" | "grid" }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setView(v: "table" | "grid") {
    const next = new URLSearchParams(sp.toString());
    next.set("view", v);
    router.push(`/properties?${next.toString()}`);
  }

  const base = "inline-flex h-7 w-8 items-center justify-center transition-colors";
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => setView("table")}
        className={cn(base, view === "table" ? "bg-surface-muted text-text" : "bg-surface text-text-muted hover:bg-surface-muted")}
        aria-label="Vista tabla"
      >
        <Rows3 size={14} />
      </button>
      <button
        type="button"
        onClick={() => setView("grid")}
        className={cn(base, "border-l border-border", view === "grid" ? "bg-surface-muted text-text" : "bg-surface text-text-muted hover:bg-surface-muted")}
        aria-label="Vista cuadrícula"
      >
        <LayoutGrid size={14} />
      </button>
    </div>
  );
}
