"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, X, GitMerge, ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { formatPrice } from "@buysell/shared";

type Candidate = {
  propertyId: string;
  title: string;
  city: string;
  thumbnailUrl: string | null;
  portals: string[];
  currentPrice: number | null;
  score: number;
  reasons: string[];
};

const PORTAL_LABEL: Record<string, string> = {
  IDEALISTA: "Idealista", FOTOCASA: "Fotocasa", PISOS_COM: "Pisos.com",
  MILANUNCIOS: "Milanuncios", HABITACLIA: "Habitaclia", YAENCONTRE: "Yaencontre",
  THINKSPAIN: "ThinkSPAIN", INDOMIO: "Indomio", OTHER: "Otro", MANUAL: "Manual",
};

export function SimilarPropertiesCard({ propertyId }: { propertyId: string }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/properties/${propertyId}/similar`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCandidates(d.candidates ?? []);
      })
      .catch(() => !cancelled && setCandidates([]));
    return () => { cancelled = true; };
  }, [propertyId]);

  if (candidates == null || candidates.length === 0) return null;

  async function handleMerge(c: Candidate) {
    if (working) return;
    const ok = confirm(
      `¿Fusionar este inmueble dentro de "${c.title}"?\n\n` +
      `Los datos del actual se mantendrán y se moverán los anuncios y fotos. El inmueble actual desaparecerá.\n\n` +
      `Confianza: ${c.score}%\n${c.reasons.join("\n")}`
    );
    if (!ok) return;
    setWorking(c.propertyId);
    try {
      const res = await fetch(`/api/properties/${propertyId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intoId: c.propertyId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert("Error: " + (e.error || res.statusText));
        return;
      }
      router.push(`/properties/${c.propertyId}`);
    } finally {
      setWorking(null);
    }
  }

  async function handleDismiss(c: Candidate) {
    if (working) return;
    setWorking(c.propertyId);
    try {
      const res = await fetch(`/api/properties/${propertyId}/dismiss-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: c.propertyId }),
      });
      if (res.ok) {
        setCandidates((cs) => (cs ?? []).filter((x) => x.propertyId !== c.propertyId));
      }
    } finally {
      setWorking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Sparkles size={14} className="mr-1 inline text-warning" />
          Posibles duplicados
        </CardTitle>
        <span className="text-xs text-text-muted">{candidates.length}</span>
      </CardHeader>
      <CardBody className="space-y-3">
        {candidates.map((c) => (
          <div key={c.propertyId} className="flex gap-3 rounded-md border border-border bg-surface p-2.5">
            <Link href={`/properties/${c.propertyId}`} className="shrink-0">
              {c.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-16 w-20 rounded border border-border object-cover"
                />
              ) : (
                <div className="h-16 w-20 rounded border border-border bg-surface-muted" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/properties/${c.propertyId}`}
                className="line-clamp-1 inline-flex items-center gap-1 text-sm font-medium text-text hover:text-primary"
              >
                {c.title} <ExternalLink size={11} className="text-text-subtle" />
              </Link>
              <div className="mt-0.5 text-xs text-text-muted">
                {c.city} · {formatPrice(c.currentPrice)} · {c.portals.map((p) => PORTAL_LABEL[p] ?? p).join(", ")}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.reasons.map((r, i) => (
                  <span key={i} className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-1">
              <div
                className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular ${
                  c.score >= 90
                    ? "bg-success-soft text-success"
                    : c.score >= 70
                    ? "bg-warning-soft text-warning"
                    : "bg-surface-muted text-text-muted"
                }`}
                title="Score de coincidencia"
              >
                {c.score}%
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleMerge(c)}
                  disabled={working === c.propertyId}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-text-subtle hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                  title="Fusionar"
                >
                  <GitMerge size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(c)}
                  disabled={working === c.propertyId}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  title="Descartar (no es el mismo)"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
