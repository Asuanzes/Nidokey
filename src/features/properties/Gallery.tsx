"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Photo = { id: string; url: string; caption?: string | null };

export function Gallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-text-subtle">
        <div className="flex flex-col items-center gap-2">
          <ImageIcon size={28} />
          <span className="text-sm">Sin fotos</span>
        </div>
      </div>
    );
  }

  const cur = photos[active];
  const prev = () => setActive((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setActive((i) => (i + 1) % photos.length);

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.url}
          alt={cur.caption ?? ""}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-1.5 text-text shadow-sm backdrop-blur hover:bg-surface"
              aria-label="Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface/90 p-1.5 text-text shadow-sm backdrop-blur hover:bg-surface"
              aria-label="Siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-surface/90 px-2 py-0.5 text-xs text-text-muted shadow-sm backdrop-blur tabular">
              {active + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-md border transition-all",
                i === active ? "border-primary ring-2 ring-primary/15" : "border-border opacity-80 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
