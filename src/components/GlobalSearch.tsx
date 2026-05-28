"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatPrice } from "@nidokey/shared";

type Result = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  currentPrice: number | null;
  type: string;
  media: { url: string }[];
};

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const d = await res.json();
        setResults(d.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar inmuebles, direcciones, refs..."
        className="h-9 w-full rounded-md border border-border bg-bg pl-8 pr-3 text-sm placeholder:text-text-subtle hover:border-border-strong focus:border-primary focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {loading && (
            <div className="px-3 py-2 text-xs text-text-subtle">Buscando…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-subtle">Sin resultados</div>
          )}
          {!loading && results.map((r) => (
            <Link
              key={r.id}
              href={`/properties/${r.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-surface-muted"
            >
              {r.media[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.media[0].url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-10 w-12 shrink-0 rounded border border-border object-cover"
                />
              ) : (
                <div className="h-10 w-12 shrink-0 rounded border border-border bg-surface-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm text-text">{r.title}</div>
                <div className="line-clamp-1 text-xs text-text-muted">
                  {r.neighborhood ? `${r.neighborhood}, ` : ""}{r.city}
                </div>
              </div>
              <div className="shrink-0 text-xs font-medium text-text tabular">
                {formatPrice(r.currentPrice)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
