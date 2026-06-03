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
export function useNews(type: "crypto" | "market" | null) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (type !== "crypto" && type !== "market") {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ items: NewsItem[] }>(`/api/news?type=${type}`);
      setItems(r.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las noticias");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}
