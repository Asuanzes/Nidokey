"use client";

import { useState } from "react";
import Link from "next/link";

type Status = "idle" | "loading" | "ok" | "error";

type ImportResult = {
  created: boolean;
  priceChanged: boolean;
  propertyId: string;
  listingId: string;
  newPrice: number | null;
};

type ApiErr = {
  error: string;
  portal?: string;
  message?: string;
};

export function ImportForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState<ApiErr | null>(null);

  function reset() {
    setStatus("idle");
    setResult(null);
    setApiError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("loading");
    setResult(null);
    setApiError(null);
    try {
      const res = await fetch("/api/listings/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as ImportResult | ApiErr;
      if (!res.ok) {
        setApiError(data as ApiErr);
        setStatus("error");
      } else {
        setResult(data as ImportResult);
        setStatus("ok");
      }
    } catch {
      setApiError({ error: "network", message: "Error de red. Comprueba tu conexión." });
      setStatus("error");
    }
  }

  const isManualOnly = apiError?.error === "manual_only";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); reset(); }}
          placeholder="https://www.fotocasa.es/es/comprar/vivienda/…"
          required
          disabled={status === "loading"}
          className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || !url.trim()}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg shadow-xs hover:bg-primary-hover disabled:opacity-50"
        >
          {status === "loading" ? "Importando…" : "Importar"}
        </button>
      </form>

      {status === "ok" && result && (
        <div className="rounded-md border border-success bg-success-soft px-4 py-3 text-sm">
          <p className="font-medium text-success">
            {result.created
              ? "✅ Inmueble creado"
              : result.priceChanged
              ? "💶 Precio actualizado"
              : "👌 Sin cambios — ya existía en tu catálogo"}
          </p>
          <Link
            href={`/properties/${result.propertyId}`}
            className="mt-1 block text-primary hover:underline"
          >
            Ver ficha →
          </Link>
        </div>
      )}

      {status === "error" && apiError && (
        isManualOnly ? (
          <div className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm">
            <p className="font-medium text-warning">Portal no compatible con importación automática</p>
            <p className="mt-1 text-text-muted">
              <strong>{apiError.portal}</strong> usa protección anti-bot que bloquea el scraping desde el servidor.
              Puedes añadirlo manualmente rellenando el formulario.
            </p>
            <Link href="/properties/new" className="mt-2 block text-primary hover:underline">
              Crear ficha manualmente →
            </Link>
          </div>
        ) : (
          <div className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
            {apiError.message ?? "Ha ocurrido un error. Inténtalo de nuevo."}
          </div>
        )
      )}
    </div>
  );
}
