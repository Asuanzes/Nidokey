"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Chip({
  active = false,
  onRemove,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text",
        className
      )}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-1 ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/5"
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}
