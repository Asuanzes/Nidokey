"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button, Checkbox, Field, FormSection, Input, Select, Textarea,
} from "@/components/ui";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  initial?: Record<string, unknown>;
  id?: string;
};

const TYPES = [
  ["PISO", "Piso"], ["HOUSE", "Casa"], ["ATICO", "Ático"], ["CHALET", "Chalet"],
  ["DUPLEX", "Dúplex"], ["ESTUDIO", "Estudio"], ["LOFT", "Loft"], ["LOCAL", "Local"],
  ["TERRENO", "Terreno"], ["OTRO", "Otro"],
] as const;

const STATUSES = [
  ["FOR_SALE", "En venta"], ["RESERVED", "Reservado"],
  ["SOLD", "Vendido"], ["WITHDRAWN", "Retirado"],
] as const;

const FEATURES: [string, string][] = [
  ["hasElevator", "Ascensor"],
  ["hasGarage", "Garaje"],
  ["hasStorage", "Trastero"],
  ["hasTerrace", "Terraza"],
  ["hasFireplace", "Chimenea"],
  ["hasGarden", "Jardín"],
  ["hasPool", "Piscina"],
];

export function PropertyForm({ mode, initial, id }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const obj: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) {
      if (v === "") continue;
      obj[k] = v;
    }
    for (const [k] of FEATURES) {
      obj[k] = fd.get(k) === "on" ? true : undefined;
    }
    if (obj.currentPrice) obj.currentPrice = Math.round(Number(obj.currentPrice) * 100);
    if (typeof obj.tags === "string") {
      obj.tags = (obj.tags as string).split(",").map((s) => s.trim()).filter(Boolean);
    }

    const url = mode === "create" ? "/api/properties" : `/api/properties/${id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : JSON.stringify(body.error ?? body));
      setSaving(false);
      return;
    }
    const saved = await res.json();
    router.push(`/properties/${saved.id ?? id}`);
    router.refresh();
  }

  const v = (k: string) => (initial?.[k] as string | number | boolean | null | undefined) ?? "";
  const checked = (k: string) => Boolean(initial?.[k]);
  const priceInEuros = initial?.currentPrice != null ? Number(initial.currentPrice) / 100 : "";
  const tagsCsv = Array.isArray(initial?.tags) ? (initial?.tags as string[]).join(", ") : "";

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface px-6 shadow-xs">
      <FormSection
        title="Datos básicos"
        description="Identificación y estado comercial del inmueble."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título" required className="md:col-span-2">
            <Input name="title" required defaultValue={String(v("title"))} placeholder="Piso reformado en el centro de Oviedo..." />
          </Field>
          <Field label="Tipo" required>
            <Select name="type" defaultValue={String(v("type") || "PISO")}>
              {TYPES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </Select>
          </Field>
          <Field label="Estado" required>
            <Select name="status" defaultValue={String(v("status") || "FOR_SALE")}>
              {STATUSES.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </Select>
          </Field>
          <Field label="Precio (€)" hint="Se guarda en céntimos internamente.">
            <Input name="currentPrice" type="number" defaultValue={String(priceInEuros)} placeholder="245000" />
          </Field>
          <Field label="Año de construcción">
            <Input name="yearBuilt" type="number" defaultValue={String(v("yearBuilt"))} placeholder="1978" />
          </Field>
          <Field label="Descripción" className="md:col-span-2">
            <Textarea name="description" rows={4} defaultValue={String(v("description"))} placeholder="Características generales, reformas, orientación..." />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Ubicación"
        description="Dirección y referencias para integraciones (Catastro)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Dirección" className="md:col-span-2">
            <Input name="address" defaultValue={String(v("address"))} placeholder="Calle Uría 22" />
          </Field>
          <Field label="Ciudad" required>
            <Input name="city" required defaultValue={String(v("city"))} />
          </Field>
          <Field label="Provincia" required>
            <Input name="province" required defaultValue={String(v("province") || "Asturias")} />
          </Field>
          <Field label="Barrio">
            <Input name="neighborhood" defaultValue={String(v("neighborhood"))} />
          </Field>
          <Field label="Código postal">
            <Input name="postalCode" defaultValue={String(v("postalCode"))} />
          </Field>
          <Field label="Referencia catastral" hint="20 caracteres alfanuméricos." className="md:col-span-2">
            <Input name="cadastralRef" defaultValue={String(v("cadastralRef"))} placeholder="9872023VH5797S0001WX" />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Características"
        description="Superficies, distribución y extras."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Habitaciones"><Input name="rooms" type="number" defaultValue={String(v("rooms"))} /></Field>
          <Field label="Baños"><Input name="bathrooms" type="number" defaultValue={String(v("bathrooms"))} /></Field>
          <Field label="Planta"><Input name="floor" defaultValue={String(v("floor"))} placeholder="3, bajo, ático..." /></Field>
          <Field label="m² construidos"><Input name="builtArea" type="number" defaultValue={String(v("builtArea"))} /></Field>
          <Field label="m² útiles"><Input name="usableArea" type="number" defaultValue={String(v("usableArea"))} /></Field>
          <Field label="m² parcela"><Input name="plotArea" type="number" defaultValue={String(v("plotArea"))} /></Field>
        </div>

        <div className="rounded-md border border-border bg-bg p-4">
          <div className="mb-2 text-xs font-medium text-text-muted">Extras</div>
          <div className="grid grid-cols-2 gap-y-2 md:grid-cols-3">
            {FEATURES.map(([k, lbl]) => (
              <label key={k} className="inline-flex items-center gap-2 text-sm text-text">
                <Checkbox name={k} defaultChecked={checked(k)} /> {lbl}
              </label>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Entorno y notas"
        description="Información cualitativa y privada."
      >
        <Field label="Entorno (barrio, servicios, transporte...)">
          <Textarea name="environment" rows={3} defaultValue={String(v("environment"))} />
        </Field>
        <Field label="Tags" hint="Separados por coma.">
          <Input name="tags" defaultValue={tagsCsv} placeholder="parque_cercano, transporte_publico, colegios" />
        </Field>
        <Field label="Notas privadas" hint="Visibles solo en la ficha interna.">
          <Textarea name="notes" rows={3} defaultValue={String(v("notes"))} />
        </Field>
      </FormSection>

      <div className="flex items-center justify-between border-t border-border py-5">
        {error ? (
          <div className="text-sm text-danger">{error}</div>
        ) : (
          <div className="text-xs text-text-subtle">Los cambios no se guardan hasta pulsar el botón.</div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : mode === "create" ? "Crear inmueble" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
