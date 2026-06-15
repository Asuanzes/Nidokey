import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type NewsItem = {
  title: string;
  url: string;
  summary: string | null;
  source: string | null;
  publishedAt: string | null;
  symbol: string;
};

/**
 * Noticias de los activos registrados del usuario para una categoría financiera
 * (cripto/mercado). Carga al montar y cuando cambia el tipo. `reload` para
 * pull-to-refresh del sheet. Si `type` no es financiero, no pide nada.
 */
export type NewsQuery =
  | "crypto"
  | "market"
  | { kind: "trend"; trendId: string | null | undefined }
  | null;

export function useNews(query: NewsQuery) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const path = newsPath(query);
    if (!path) {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ items: NewsItem[] }>(path);
      setItems(r.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las noticias");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

function newsPath(query: NewsQuery): string | null {
  if (query === "crypto" || query === "market") {
    return `/api/news?type=${query}`;
  }
  if (query?.kind === "trend" && query.trendId) {
    return `/api/trends/${encodeURIComponent(query.trendId)}/news`;
  }
  return null;
}
