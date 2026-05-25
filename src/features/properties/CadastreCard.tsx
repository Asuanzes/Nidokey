"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ExternalLink, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type CadastralData = {
  ref?: string;
  address?: string;
  use?: string;
  builtArea?: number;
  yearBuilt?: number;
  floor?: string;
  hasFloorplan?: boolean;
  floorplanUrl?: string;
};

type Props = {
  propertyId: string;
  cadastralRef: string | null;
  cadastralData: unknown;
  // Datos actuales para prellenar el form
  province?: string | null;
  city?: string | null;
  address?: string | null;
};

/**
 * Genera la URL de Sede del Catastro adaptada al tipo de RC.
 *  - Urbana (14 o 20 chars empezando por números): URL genérica con RefC.
 *  - Rústica (segundo bloque empieza con letra mayúscula): añade TipUR=R.
 */
function sedeUrl(rc: string): string {
  const base = "https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCConCiud.aspx";
  const params = new URLSearchParams();
  const isRustica = /^\d{5}[A-Z]/.test(rc);
  if (isRustica) {
    params.set("TipUR", "R");
    params.set("del", rc.slice(0, 2));
    params.set("mun", rc.slice(2, 5));
  }
  params.set("RefC", rc);
  return `${base}?${params.toString()}`;
}

export function CadastreCard({ propertyId, cadastralRef, cadastralData, province, city, address }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [form, setForm] = useState({
    province: province ?? "Asturias",
    city: city ?? "",
    address: address ?? "",
    latitude: "",
    longitude: "",
  });
  const router = useRouter();

  const data = (cadastralData ?? null) as CadastralData | null;

  async function lookup(override?: typeof form) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const body: Record<string, unknown> = {};
      if (override) {
        if (override.province) body.province = override.province;
        if (override.city) body.city = override.city;
        if (override.address) body.address = override.address;
        const lat = parseFloat(override.latitude);
        const lng = parseFloat(override.longitude);
        if (Number.isFinite(lat)) body.latitude = lat;
        if (Number.isFinite(lng)) body.longitude = lng;
      }
      const res = await fetch(`/api/properties/${propertyId}/cadastre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || `Error ${res.status}`);
        if (Array.isArray(data.warnings)) setWarnings(data.warnings);
        return;
      }
      if (Array.isArray(data.warnings) && data.warnings.length) setWarnings(data.warnings);
      setShowManual(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  if (!cadastralRef) {
    return (
      <div className="space-y-2 border-t border-border pt-2">
        <div className="text-xs text-text-subtle">Referencia catastral</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => lookup()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text hover:bg-surface-muted disabled:opacity-50"
          >
            <Search size={12} />
            {loading ? "Buscando…" : "Buscar en Catastro"}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-text-muted hover:bg-surface-muted hover:text-text"
          >
            {showManual ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Manual
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-1.5 text-xs text-danger">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <ul className="text-[11px] text-text-subtle">
            {warnings.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        )}

        {showManual && (
          <div className="space-y-2 rounded-md border border-border bg-surface-muted p-2">
            <div className="text-[11px] text-text-muted">
              Rellena los datos disponibles y pulsa buscar. Las coordenadas son lo más fiable;
              si no las tienes, usa provincia + ciudad + calle + número.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Provincia"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="h-7 rounded-md border border-border bg-bg px-2 text-xs"
              />
              <input
                placeholder="Ciudad"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-7 rounded-md border border-border bg-bg px-2 text-xs"
              />
              <input
                placeholder="Dirección (calle, nº)"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="col-span-2 h-7 rounded-md border border-border bg-bg px-2 text-xs"
              />
              <input
                placeholder="Latitud (ej. 43.3614)"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="h-7 rounded-md border border-border bg-bg px-2 text-xs"
              />
              <input
                placeholder="Longitud (ej. -5.8593)"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="h-7 rounded-md border border-border bg-bg px-2 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => lookup(form)}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
            >
              <Search size={11} />
              {loading ? "Buscando…" : "Buscar con estos datos"}
            </button>
            <div className="text-[11px] text-text-subtle">
              💡 Para coords exactas, busca el inmueble en{" "}
              <a
                href="https://www.google.com/maps"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Google Maps
              </a>{" "}
              → click derecho → copia las dos cifras.
            </div>
          </div>
        )}
      </div>
    );
  }

  // Ya tiene RC
  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
      <div className="text-xs text-text-subtle">Referencia catastral</div>
      <div className="flex items-center gap-2">
        <code className="font-mono text-xs text-text">{cadastralRef}</code>
        <a
          href={sedeUrl(cadastralRef)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
          title="Ver en Sede del Catastro"
        >
          <ExternalLink size={11} />
        </a>
      </div>
      {data && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
          {data.use && (<><dt>Uso</dt><dd className="text-text">{data.use}</dd></>)}
          {data.builtArea != null && (<><dt>m² (Cat.)</dt><dd className="text-text">{data.builtArea}</dd></>)}
          {data.yearBuilt != null && (<><dt>Año (Cat.)</dt><dd className="text-text">{data.yearBuilt}</dd></>)}
          {data.address && (<><dt>Dirección</dt><dd className="text-text">{data.address}</dd></>)}
        </dl>
      )}
      {!data && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-2 text-[11px] text-warning">
          Esta referencia existe pero Catastro no tiene datos descriptivos del inmueble.
          Suele pasar con parcelas rústicas o construcciones recientes en proceso.
          Prueba a refinar la dirección y re-consultar.
        </div>
      )}
      <button
        type="button"
        onClick={() => lookup()}
        disabled={loading}
        className="text-[11px] text-primary hover:underline disabled:opacity-50"
      >
        {loading ? "Actualizando…" : "Re-consultar"}
      </button>
      {error && (
        <div className="text-[11px] text-danger">{error}</div>
      )}
      {warnings.length > 0 && (
        <ul className="text-[11px] text-text-subtle">
          {warnings.map((w, i) => <li key={i}>• {w}</li>)}
        </ul>
      )}
    </div>
  );
}
