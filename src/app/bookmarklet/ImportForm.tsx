"use client";

import { useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";

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
  const [copied, setCopied] = useState(false);

  function reset() {
    setStatus("idle");
    setResult(null);
    setApiError(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus("loading");
    setResult(null);
    setApiError(null);
    setCopied(false);
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

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
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
          /* Portal bloqueado server-side → redirigir al móvil via QR */
          <div className="rounded-md border border-border bg-surface-muted p-5 text-sm space-y-4">
            <div>
              <p className="font-semibold text-text">
                📱 Importa este portal desde la app móvil
              </p>
              <p className="mt-1 text-text-muted">
                <strong>{apiError.portal}</strong> bloquea el scraping desde el servidor (DataDome).
                Escanea el QR con tu móvil o copia la URL y pégala en la pantalla <em>Importar</em> de la app Nidokey.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="rounded-lg border border-border bg-white p-3 shadow-xs">
                <QRCode value={url.trim()} size={140} />
              </div>
              <div className="flex flex-col gap-2 text-xs text-text-muted">
                <p className="font-medium text-text">Pasos:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Escanea el código con la cámara del móvil</li>
                  <li>Abre el enlace en el navegador del móvil</li>
                  <li>Comparte la página con la app Nidokey (Android)</li>
                  <li className="text-text-subtle">— o copia la URL y pégala en la app —</li>
                </ol>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="mt-1 h-8 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text hover:bg-surface-muted"
                >
                  {copied ? "✓ Copiado" : "Copiar URL"}
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-3 text-xs text-text-subtle">
              ¿Prefieres añadirlo manualmente?{" "}
              <Link href="/properties/new" className="text-primary hover:underline">
                Crear ficha →
              </Link>
            </div>
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
