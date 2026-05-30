import { useCallback } from "react";

import { useQuery, type UseQueryOptions, type UseQueryResult } from "./useQuery";

/**
 * Hook para un único registro (detalle). Genérico: recibe el fetcher del
 * dominio concreto (p. ej. fetchPropertyDetail) para no acoplar el detalle a
 * un tipo. Revalida al volver a primer plano por defecto.
 */
export function useRecord<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const stable = useCallback(fetcher, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return useQuery(stable, deps, { revalidateOnFocus: true, ...options });
}
