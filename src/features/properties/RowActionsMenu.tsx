"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  propertyId: string;
  propertyTitle: string;
  variant?: "row" | "card";
};

/**
 * Acciones inline para cada inmueble: Editar + Eliminar.
 * Sin dropdown (evitamos problemas de overflow/z-index).
 */
export function RowActionsMenu({ propertyId, propertyTitle, variant = "row" }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    const ok = window.confirm(`¿Eliminar "${propertyTitle}"? Esta acción es irreversible.`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert("Error al eliminar: " + (data.error || res.statusText));
        return;
      }
      router.refresh();
    } catch (err) {
      alert("Error de red: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (variant === "card") {
    // En cards: iconos compactos con fondo sólido sobre la foto.
    return (
      <div className="flex items-center gap-1 rounded-md bg-surface/95 p-0.5 shadow-sm backdrop-blur-sm">
        <Link
          href={`/properties/${propertyId}/edit`}
          onClick={stop}
          aria-label="Editar"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text"
        >
          <Pencil size={14} />
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Eliminar"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-text-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  // Variant "row" — para la tabla
  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={`/properties/${propertyId}/edit`}
        onClick={stop}
        aria-label="Editar"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-subtle",
          "transition-colors hover:bg-surface-muted hover:text-text"
        )}
      >
        <Pencil size={14} />
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Eliminar"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-subtle",
          "transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        )}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
