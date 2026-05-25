"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertCircle, ExternalLink, Check } from "lucide-react";
import { formatPrice } from "@buysell/shared";

type Props = {
  listingId: string;
  portal: string;
  url: string;
  manualOnly?: boolean;
  lastCheckedAt: Date | string | null;
};

const STALE_DAYS = 7;
const MANUAL_PORTALS = new Set(["IDEALISTA", "MILANUNCIOS", "YAENCONTRE"]);

type Toast = {
  text: string;
  tone: "success" | "info" | "warning" | "danger";
};

export function ListingRecheck({ listingId, portal, url, lastCheckedAt }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const router = useRouter();

  // Auto-ocultar toast tras 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const isManual = MANUAL_PORTALS.has(portal);
  const lastCheck = lastCheckedAt ? new Date(lastCheckedAt) : null;
  const daysSince = lastCheck
    ? Math.floor((Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysSince == null || daysSince >= STALE_DAYS;

  async function handleRecheck() {
    if (loading || isManual) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/listings/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      if (data.outcome === "blocked") {
        setBlocked(true);
        setError(null);
      } else if (data.outcome === "gone") {
        setError(null);
        setBlocked(false);
        setToast({ text: "Anuncio retirado o vendido", tone: "warning" });
      } else if (data.outcome === "error") {
        setError(data.detail ?? data.outcome);
        setBlocked(false);
      } else if (data.outcome === "ok") {
        setError(null);
        setBlocked(false);
        if (data.priceChanged && data.previousPrice != null && data.newPrice != null) {
          const dir = data.newPrice < data.previousPrice ? "📉" : "📈";
          setToast({
            text: `${dir} ${formatPrice(data.previousPrice)} → ${formatPrice(data.newPrice)}`,
            tone: data.newPrice < data.previousPrice ? "success" : "info",
          });
        } else {
          setToast({ text: "Sin cambios", tone: "info" });
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  if (isManual || blocked) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1 text-[11px] text-text-subtle">
          <AlertCircle size={11} />
          {blocked ? "Bloqueado por anti-bot" : "Manual"} — usa el userscript
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
        >
          Abrir anuncio <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  const toneClasses: Record<Toast["tone"], string> = {
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    danger: "text-danger",
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleRecheck}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50"
        title="Volver a comprobar este anuncio"
      >
        <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        {loading ? "Comprobando…" : "Re-check"}
      </button>
      {isStale && lastCheck && !toast && (
        <span className="text-[11px] text-warning" title="Más de 7 días sin comprobar">
          ⚠ {daysSince}d
        </span>
      )}
      {toast && (
        <span className={`inline-flex items-center gap-1 text-[11px] ${toneClasses[toast.tone]}`}>
          {toast.tone === "success" || toast.tone === "info" ? <Check size={10} /> : null}
          {toast.text}
        </span>
      )}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
