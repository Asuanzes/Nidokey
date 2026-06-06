import { useEffect, useState } from "react";

/**
 * Señal mínima para mantener SINCRONIZADOS el badge de "Duplicados" (en el layout
 * de tabs) y la pantalla de duplicados. Tras fusionar/descartar en la pantalla, el
 * badge debe recontar — pero vive en otro componente y `pathname` no cambia. Esto
 * publica un "han cambiado los duplicados" que el badge observa para refetch.
 *
 * Sin dependencias (no React Query): un pub/sub de módulo + un hook contador.
 */
const listeners = new Set<() => void>();

/** Llamar tras una fusión/descarte para que el badge se recalcule. */
export function notifyDuplicatesChanged(): void {
  listeners.forEach((l) => l());
}

/** Devuelve un contador que incrementa en cada `notifyDuplicatesChanged()`.
 *  Úsalo como dependencia de un efecto para revalidar (p. ej. el badge). */
export function useDuplicatesChanged(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return n;
}
