"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitMerge, X, ArrowRight, ExternalLink } from "lucide-react";
import { Card, CardBody } from "@/components/ui";
import { formatPrice } from "@buysell/shared";

type PropMin = {
  id: string;
  title: string;
  city: string;
  currentPrice: number | null;
  type: string;
  builtArea: number | null;
  media: { url: string }[];
  listings: { portal: string; url: string }[];
};

type Item = {
  id: string;
  score: number;
  reasons: string[];
  source: PropMin;
  target: PropMin;
};

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

export function MatchesList({ items }: { items: Item[] }) {
  const [working, setWorking] = useState<string | null>(null);
  const router = useRouter();

  async function handleMerge(sourceId: string, targetId: string, title: string, score: number) {
    if (working) return;
    if (!confirm(`Fusionar dentro de "${title}" (score ${score}%)?\n\nLa otra ficha desaparecerá; sus listings y fotos pasarán aquí.`)) return;
    setWorking(sourceId);
    try {
      const res = await fetch(`/api/properties/${sourceId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intoId: targetId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert("Error: " + (e.error || res.statusText));
        return;
      }
      router.refresh();
    } finally {
      setWorking(null);
    }
  }

  async function handleDismiss(sourceId: string, candidateId: string) {
    if (working) return;
    setWorking(sourceId + ":" + candidateId);
    try {
      const res = await fetch(`/api/properties/${sourceId}/dismiss-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((m) => (
        <Card key={m.id}>
          <CardBody>
            <div className="flex items-center gap-3">
              <PropertySide p={m.source} />
              <div className="flex shrink-0 flex-col items-center gap-1">
                <ArrowRight size={16} className="text-text-subtle" />
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular ${
                    m.score >= 90
                      ? "bg-success-soft text-success"
                      : m.score >= 70
                      ? "bg-warning-soft text-warning"
                      : "bg-surface-muted text-text-muted"
                  }`}
                >
                  {m.score}%
                </span>
              </div>
              <PropertySide p={m.target} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {m.reasons.map((r, i) => (
                  <span key={i} className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">
                    {r}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleMerge(m.source.id, m.target.id, m.target.title, m.score)}
                  disabled={working === m.source.id}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
                >
                  <GitMerge size={12} /> Fusionar
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(m.source.id, m.target.id)}
                  disabled={working === m.source.id + ":" + m.target.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1 text-xs text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50"
                >
                  <X size={12} /> Descartar
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function PropertySide({ p }: { p: PropMin }) {
  return (
    <Link href={`/properties/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 hover:bg-surface-muted">
      {p.media[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.media[0].url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-16 w-20 shrink-0 rounded border border-border object-cover"
        />
      ) : (
        <div className="h-16 w-20 shrink-0 rounded border border-border bg-surface-muted" />
      )}
      <div className="min-w-0">
        <div className="line-clamp-1 inline-flex items-center gap-1 text-sm font-medium text-text">
          {p.title} <ExternalLink size={10} className="text-text-subtle" />
        </div>
        <div className="mt-0.5 text-xs text-text-muted">
          {p.city} · {formatPrice(p.currentPrice)} · {p.builtArea ? `${p.builtArea} m² · ` : ""}
          {p.listings.map((l) => PORTAL_LABEL[l.portal] ?? l.portal).join(", ")}
        </div>
      </div>
    </Link>
  );
}
