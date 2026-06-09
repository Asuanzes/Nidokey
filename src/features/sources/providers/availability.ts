/**
 * Disponibilidad de proveedores de metadatos (Google Books, Open Library).
 *
 * Los clientes finos históricamente tragaban TODO fallo de red/HTTP y devolvían
 * null/[], con lo que «cuota agotada» (429) era indistinguible de «libro
 * inexistente» y el usuario veía "no encontrado" con el servicio caído. Aquí se
 * separan los dos mundos:
 *   - respuesta válida sin resultados → null/[]   (no existe: NOT_FOUND honesto)
 *   - 429/403/5xx/red/timeout         → ProviderUnavailableError (reintentable)
 * Con UN reintento corto para fallos transitorios (red/5xx). El 429 de cuota
 * diaria NO se reintenta: no se repone en segundos y quemaría más cuota.
 */

export class ProviderUnavailableError extends Error {
  readonly provider: string;
  constructor(provider: string, detail: string) {
    super(`${provider} no disponible: ${detail}`);
    this.name = "ProviderUnavailableError";
    this.provider = provider;
  }
}

export function isProviderUnavailable(e: unknown): e is ProviderUnavailableError {
  return e instanceof ProviderUnavailableError;
}

const RETRY_DELAY_MS = 600;

export type StrictJsonOpts = {
  /** Nombre legible para diagnóstico ("Google Books", "Open Library"). */
  provider: string;
  timeoutMs: number;
  headers?: Record<string, string>;
};

/**
 * GET JSON con semántica estricta: devuelve null SOLO en 404 (el recurso no
 * existe — señal legítima); lanza ProviderUnavailableError en 429/4xx/5xx/
 * red/timeout, con un reintento previo si el fallo era transitorio. El caller
 * decide qué significa null ("no encontrado") frente a la excepción ("no sé").
 */
export async function getJsonStrict(url: string, opts: StrictJsonOpts): Promise<unknown | null> {
  let lastDetail = "fallo de red";
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json", ...opts.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : "fallo de red";
    }
    if (res) {
      if (res.ok) return res.json().catch(() => null);
      if (res.status === 404) return null; // el recurso no existe (señal legítima)
      lastDetail = `HTTP ${res.status}`;
      // Cuota (429) o clave inválida (4xx): reintentar no ayuda y quema cuota.
      if (res.status >= 400 && res.status < 500) break;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new ProviderUnavailableError(opts.provider, lastDetail);
}
