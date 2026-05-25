"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { PORTAL_SEARCHES, googleLensUrl } from "@/features/matching/external-search";

type Props = {
  title: string;
  city: string | null;
  rooms?: number | null;
  builtArea?: number | null;
  mainPhotoUrl?: string | null;
  excludePortal?: string | null;
};

export function SearchOtherPortalsButton({
  title,
  city,
  rooms,
  builtArea,
  mainPhotoUrl,
  excludePortal,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function go(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  const q = { title, city, rooms, builtArea };

  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
        <Globe size={13} /> Buscar en otros portales <ChevronDown size={12} />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface shadow-md">
          <div className="border-b border-border bg-surface-muted px-3 py-1.5 text-[11px] text-text-subtle">
            Google site search
          </div>
          {PORTAL_SEARCHES.map((p) => {
            const isExcluded =
              excludePortal &&
              (p.key === excludePortal.toLowerCase() ||
                p.label.toLowerCase().replace(/[.\s]/g, "") ===
                  excludePortal.toLowerCase().replace(/[_\s.]/g, ""));
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => go(p.buildUrl(q))}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-text hover:bg-surface-muted"
                disabled={!!isExcluded}
                title={isExcluded ? "Este es el portal del anuncio actual" : undefined}
              >
                <span className={isExcluded ? "text-text-subtle line-through" : ""}>
                  {p.label}
                </span>
                <ExternalLink size={11} className="text-text-subtle" />
              </button>
            );
          })}
          {mainPhotoUrl && (
            <>
              <div className="border-y border-border bg-surface-muted px-3 py-1.5 text-[11px] text-text-subtle">
                Reverse image
              </div>
              <button
                type="button"
                onClick={() => go(googleLensUrl(mainPhotoUrl))}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-text hover:bg-surface-muted"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon size={12} /> Google Lens
                </span>
                <ExternalLink size={11} className="text-text-subtle" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
