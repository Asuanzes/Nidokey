"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

const OPTIONS = [
  ["updatedAt-desc", "Última actualización"],
  ["createdAt-desc", "Fecha de alta"],
  ["currentPrice-asc", "Precio (menor → mayor)"],
  ["currentPrice-desc", "Precio (mayor → menor)"],
] as const;

export function SortMenu({ value }: { value: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function onChange(v: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("sort", v);
    router.push(`/properties?${next.toString()}`);
  }

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs">
      {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
}
