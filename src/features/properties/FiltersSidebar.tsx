"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

const TYPES = [
  ["", "Todos"], ["PISO", "Piso"], ["HOUSE", "Casa"], ["ATICO", "Ático"],
  ["CHALET", "Chalet"], ["DUPLEX", "Dúplex"], ["ESTUDIO", "Estudio"],
  ["LOFT", "Loft"], ["LOCAL", "Local"], ["TERRENO", "Terreno"], ["OTRO", "Otro"],
] as const;

const STATUSES = [
  ["", "Cualquiera"], ["FOR_SALE", "En venta"], ["RESERVED", "Reservado"],
  ["SOLD", "Vendido"], ["WITHDRAWN", "Retirado"],
] as const;

export function FiltersSidebar({ initial, className }: { initial: Record<string, string | undefined>; className?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(initial);

  function update(k: string, v: string | boolean | undefined) {
    setForm((prev) => ({ ...prev, [k]: v === false || v === "" || v == null ? undefined : String(v) }));
  }

  function apply() {
    const next = new URLSearchParams(sp.toString());
    for (const k of [
      "city", "province", "type", "status", "minPrice", "maxPrice", "minRooms",
      "hasFireplace", "hasGarage", "hasTerrace",
    ]) {
      const v = form[k];
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`/properties?${next.toString()}`));
  }

  function clear() {
    setForm({});
    start(() => router.push("/properties"));
  }

  return (
    <aside className={cn("space-y-5 rounded-lg border border-border bg-surface p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Filtros</h3>
        <button onClick={clear} className="text-xs text-text-muted hover:text-text">Limpiar</button>
      </div>

      <div className="space-y-3">
        <Field label="Ciudad">
          <Input defaultValue={form.city ?? ""} onChange={(e) => update("city", e.target.value)} placeholder="Oviedo, Gijón..." />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo">
            <Select value={form.type ?? ""} onChange={(e) => update("type", e.target.value)}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status ?? ""} onChange={(e) => update("status", e.target.value)}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Precio (€)">
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Mín" defaultValue={form.minPrice ?? ""} onChange={(e) => update("minPrice", e.target.value)} />
            <Input type="number" placeholder="Máx" defaultValue={form.maxPrice ?? ""} onChange={(e) => update("maxPrice", e.target.value)} />
          </div>
        </Field>

        <Field label="Habitaciones mín.">
          <Select value={form.minRooms ?? ""} onChange={(e) => update("minRooms", e.target.value)}>
            <option value="">Cualquiera</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </Select>
        </Field>

        <div>
          <div className="mb-1.5 text-xs font-medium text-text-muted">Características</div>
          <div className="space-y-1.5">
            {[
              ["hasFireplace", "Chimenea"],
              ["hasGarage", "Garaje"],
              ["hasTerrace", "Terraza"],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-text">
                <Checkbox checked={form[k] === "true"} onChange={(e) => update(k, e.target.checked)} />
                {l}
              </label>
            ))}
          </div>
        </div>
      </div>

      <Button variant="primary" className="w-full" onClick={apply} disabled={pending}>
        {pending ? "Aplicando..." : "Aplicar filtros"}
      </Button>
    </aside>
  );
}
