import { useCallback } from "react";
import type { BaseRecord, RecordListParams } from "@nidokey/shared";

import { fetchRecords } from "@/lib/data/records-repository";
import { useQuery, type UseQueryResult } from "./useQuery";

/**
 * Lista de registros del tipo indicado, con revalidación al volver a primer
 * plano y refresco periódico (tiempo casi real). Única forma de traer listas
 * de records en toda la app móvil.
 */
export function useRecords(params: RecordListParams = {}): UseQueryResult<BaseRecord[]> {
  const { type, query, limit } = params;
  const fetcher = useCallback(
    () => fetchRecords({ type, query, limit }),
    [type, query, limit]
  );
  return useQuery(fetcher, [type, query, limit], {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
  });
}
