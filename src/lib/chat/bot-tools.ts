import { issueMobileJwt } from "@/lib/mobile-jwt";

/**
 * Herramientas (function calling) del asistente Nidokey. Filosofía perezosa: NO
 * reimplementan lógica — el bot acuña un JWT del propio usuario (issueMobileJwt)
 * y llama a los endpoints `/api/...` que ya existen, así que el owner-scoping
 * (requireUserId + ownerId) lo aplican esas rutas. v1 = SOLO LECTURA (sin crear,
 * editar, borrar, fusionar ni pagar). Whitelist estricta: `runTool` solo despacha
 * las funciones de BOT_TOOLS.
 */
const BASE = (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
const RECORD_TYPES = ["property", "crypto", "market", "job", "book", "holiday"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

/** Esquema de tools en formato OpenAI (Groq lo acepta igual). */
export const BOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "listar_registros",
      description:
        "Lista los registros GUARDADOS del usuario de una categoría (sus inmuebles, criptos, mercados, empleos, libros o viajes). Úsalo para buscar/responder sobre lo que el usuario tiene.",
      parameters: {
        type: "object",
        properties: { type: { type: "string", enum: [...RECORD_TYPES], description: "Categoría a listar" } },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_registro",
      description: "Detalle de un registro concreto del usuario, por su id y categoría (id sale de listar_registros).",
      parameters: {
        type: "object",
        properties: { type: { type: "string", enum: [...RECORD_TYPES] }, id: { type: "string" } },
        required: ["type", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tendencias",
      description: "Tendencias actuales agregadas (X/Twitter, Google Trends, Hacker News, Twitch). Opcional: filtrar por fuente.",
      parameters: {
        type: "object",
        properties: { source: { type: "string", description: "twitter | googletrends | hackernews | twitch | all" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "noticias_tendencia",
      description: "Noticias relacionadas con una tendencia concreta (trend_id obtenido de la herramienta 'tendencias').",
      parameters: { type: "object", properties: { trend_id: { type: "string" } }, required: ["trend_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "noticias_activos",
      description: "Noticias de los activos del usuario: 'crypto' (sus criptos) o 'market' (sus acciones/ETFs/mercados).",
      parameters: { type: "object", properties: { type: { type: "string", enum: ["crypto", "market"] } }, required: ["type"] },
    },
  },
];

/** JWT efímero del usuario para que el bot llame a sus propios endpoints. */
export async function mintUserToken(userId: string, email: string): Promise<string> {
  return issueMobileJwt(userId, email || `${userId}@nidokey.local`);
}

function cap(s: string, n = 3000): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function apiGet(path: string, token: string): Promise<unknown> {
  if (!BASE) return { error: "config: NEXTAUTH_URL ausente" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "fallo de red" };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function compactRecords(data: unknown): unknown[] {
  const arr = Array.isArray(data) ? data : [];
  return arr.slice(0, 50).map((r: any) => ({
    id: r?.id,
    type: r?.type,
    title: r?.title,
    subtitle: r?.subtitle ?? null,
    value: r?.primaryValue ?? null,
    status: r?.status ?? null,
  }));
}

/** Despacha UNA tool de la whitelist. Devuelve siempre un string (JSON) para el LLM. */
export async function runTool(name: string | undefined, argsJson: string | undefined, token: string): Promise<string> {
  let args: Record<string, any> = {};
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    /* args inválidos → {} */
  }
  try {
    switch (name) {
      case "listar_registros": {
        const type = String(args.type || "");
        if (!RECORD_TYPES.includes(type as RecordType)) return JSON.stringify({ error: "categoría no válida" });
        return cap(JSON.stringify(compactRecords(await apiGet(`/api/records?type=${encodeURIComponent(type)}`, token))));
      }
      case "ver_registro": {
        const type = String(args.type || "");
        const id = String(args.id || "");
        if (!RECORD_TYPES.includes(type as RecordType) || !id) return JSON.stringify({ error: "type/id no válidos" });
        const data = await apiGet(`/api/records/${encodeURIComponent(id)}?type=${encodeURIComponent(type)}`, token);
        return cap(JSON.stringify(data), 4000);
      }
      case "tendencias": {
        const source = args.source ? `&source=${encodeURIComponent(String(args.source))}` : "";
        const data = (await apiGet(`/api/trends?limit=25${source}`, token)) as any;
        const items = (data?.items ?? []).map((t: any) => ({ id: t.id, name: t.name, source: t.source, volume: t.volume ?? null }));
        return cap(JSON.stringify(items));
      }
      case "noticias_tendencia": {
        const id = String(args.trend_id || "");
        if (!id) return JSON.stringify({ error: "falta trend_id" });
        const data = (await apiGet(`/api/trends/${encodeURIComponent(id)}/news`, token)) as any;
        const items = (data?.items ?? []).slice(0, 7).map((n: any) => ({ title: n.title, source: n.source ?? null, url: n.url }));
        return cap(JSON.stringify(items));
      }
      case "noticias_activos": {
        const type = String(args.type || "");
        if (type !== "crypto" && type !== "market") return JSON.stringify({ error: "type debe ser crypto|market" });
        const data = (await apiGet(`/api/news?type=${type}`, token)) as any;
        const items = (data?.items ?? []).slice(0, 10).map((n: any) => ({ title: n.title, source: n.source ?? null, url: n.url, at: n.publishedAt ?? null }));
        return cap(JSON.stringify(items));
      }
      default:
        return JSON.stringify({ error: "herramienta desconocida" });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "fallo de la herramienta" });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
