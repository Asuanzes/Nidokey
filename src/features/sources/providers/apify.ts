/**
 * Cliente fino de Apify para ejecutar actores del Store y recoger sus resultados
 * en UNA llamada (`run-sync-get-dataset-items`). El token (`APIFY_TOKEN`) SOLO
 * vive en el servidor (env), NUNCA en el repo ni en el cliente.
 *
 * Pensado para uso POC con el plan free de Apify ($5/ciclo): por eso SIEMPRE
 * manda topes de coste — `maxItems` (límite de resultados cobrados) y
 * `maxTotalChargeUsd` (tope de gasto en $ por run, para actores pay-per-event).
 *
 * Mismo estilo que providers/yahoo.ts y twelvedata.ts: `fetch` plano, sin SDK
 * (sin dependencia nueva).
 *
 * Doc: https://docs.apify.com/api/v2 — Run Actor synchronously and get dataset items.
 */
const BASE = "https://api.apify.com/v2";

/** Item crudo del dataset de un actor (JSON arbitrario). */
export type ApifyItem = Record<string, unknown>;

/** ¿Hay token de Apify configurado? (no lanza; patrón de los otros providers `hasXKey`). */
export function hasApifyToken(): boolean {
  return Boolean(process.env.APIFY_TOKEN?.trim());
}

/** Lee el token del entorno o lanza un error claro (patrón de twelvedata.ts). */
export function apifyToken(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    throw new Error(
      "Falta APIFY_TOKEN en el entorno (.env.local / Vercel). " +
        "Consíguelo en Apify Console → Settings → API & Integrations."
    );
  }
  return t;
}

export type RunActorOpts = {
  /** Tope de resultados COBRADOS — protege el presupuesto. Default 25. */
  maxItems?: number;
  /** Tope de gasto en $ por run (pay-per-event). Default 0.10. */
  maxTotalChargeUsd?: number;
  /** Timeout del run en segundos (la llamada síncrona corta a los 300). Default 120. */
  timeoutSecs?: number;
  /** Memoria del actor en MB (potencia de 2). Por defecto, la del actor. */
  memoryMbytes?: number;
  /**
   * Omite `maxItems`/`maxTotalChargeUsd` de la query. Algunos actores (p. ej.
   * `valig/indeed-jobs-scraper`) ABORTAN el run si reciben `maxItems` en la
   * query; en ellos el tope se pone por el campo `limit` del INPUT. El gasto
   * sigue acotado porque `limit` limita los resultados (pay-per-result barato).
   */
  omitChargeGuards?: boolean;
};

/**
 * Ejecuta un actor (`author/name`) con `input` y devuelve los items de su
 * dataset. No reintenta; lanza con el cuerpo de error de Apify si falla.
 *
 * Apify acepta el id como `author~name` en la ruta; admitimos también la forma
 * `author/name` y la convertimos.
 */
export async function runActorGetItems(
  actorId: string,
  input: Record<string, unknown>,
  opts: RunActorOpts = {}
): Promise<{ items: ApifyItem[] }> {
  const {
    maxItems = 25,
    maxTotalChargeUsd = 0.1,
    timeoutSecs = 120,
    memoryMbytes,
    omitChargeGuards = false,
  } = opts;

  const id = actorId.trim().replace("/", "~");
  const qs = new URLSearchParams({
    token: apifyToken(),
    timeout: String(timeoutSecs),
  });
  if (!omitChargeGuards) {
    qs.set("maxItems", String(maxItems));
    qs.set("maxTotalChargeUsd", String(maxTotalChargeUsd));
  }
  if (memoryMbytes) qs.set("memory", String(memoryMbytes));

  const url = `${BASE}/acts/${id}/run-sync-get-dataset-items?${qs.toString()}`;

  // AbortController + clearTimeout (no AbortSignal.timeout): así no queda un timer
  // colgante manteniendo vivo el event loop tras la respuesta (importante para
  // scripts CLI; evita el "Assertion failed" de libuv al salir en Windows).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeoutSecs + 30) * 1000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apify actor "${actorId}" respondió ${res.status}: ${body.slice(0, 400)}`
    );
  }

  const data = (await res.json()) as unknown;
  return { items: Array.isArray(data) ? (data as ApifyItem[]) : [] };
}
