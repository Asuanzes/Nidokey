import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Hook de fetching unificado de Nidokey.
 *
 * Sustituye el patrón `useState + useEffect + fetch` que cada pantalla
 * reimplementaba a mano. Aporta, en un solo sitio:
 *  - estado data/error/loading,
 *  - refetch manual (pull-to-refresh),
 *  - revalidación "tiempo casi real": al volver a primer plano (AppState) y,
 *    opcionalmente, por intervalo.
 *
 * No es SWR/React Query (sin caché global), pero cubre lo que la app necesita
 * sin añadir dependencias pesadas. Si en el futuro se adopta React Query, este
 * hook es el único punto a cambiar.
 */
export type UseQueryOptions = {
  /** Revalida al volver la app a primer plano. Por defecto true. */
  revalidateOnFocus?: boolean;
  /** Intervalo de revalidación en ms (0 = desactivado). Por defecto 0. */
  refreshInterval?: number;
  /** Si false, no ejecuta el fetch (p. ej. query vacía en búsqueda). */
  enabled?: boolean;
};

export type UseQueryResult<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** true durante una revalidación con datos ya presentes (no primer load). */
  refreshing: boolean;
  refetch: () => Promise<void>;
};

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const { revalidateOnFocus = true, refreshInterval = 0, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Mantener el fetcher más reciente sin re-suscribir efectos en cada render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);
  // Guarda de secuencia: al cambiar `deps` (p. ej. el tipo de registro) se
  // lanzan varios fetches; solo el ÚLTIMO puede escribir el estado. Evita que
  // una respuesta lenta y obsoleta (inmuebles) pise a la nueva (cripto).
  const runIdRef = useRef(0);

  const run = useCallback(async () => {
    const myId = ++runIdRef.current;
    if (hasData.current) setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (myId !== runIdRef.current) return; // respuesta obsoleta: descartar
      setData(result);
      setError(null);
      hasData.current = true;
    } catch (e) {
      if (myId !== runIdRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (myId === runIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch inicial + al cambiar deps.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  // Revalidación al volver a primer plano.
  useEffect(() => {
    if (!revalidateOnFocus || !enabled) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void run();
    });
    return () => sub.remove();
  }, [revalidateOnFocus, enabled, run]);

  // Revalidación por intervalo.
  useEffect(() => {
    if (!refreshInterval || !enabled) return;
    const id = setInterval(() => void run(), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, enabled, run]);

  return { data, error, loading, refreshing, refetch: run };
}
