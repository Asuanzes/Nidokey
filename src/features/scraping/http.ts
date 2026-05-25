/**
 * Cliente HTTP compartido por todos los adaptadores. Headers realistas,
 * timeout, detección de bloqueo. No usa cookies persistentes.
 */

export type FetchPageResult =
  | { kind: "ok"; html: string; status: number; finalUrl: string }
  | { kind: "gone"; status: number }
  | { kind: "blocked"; status: number; reason: string }
  | { kind: "error"; error: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function fetchPage(url: string, timeoutMs = 15000): Promise<FetchPageResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (res.status === 404 || res.status === 410) {
      return { kind: "gone", status: res.status };
    }
    if (res.status === 403 || res.status === 429) {
      return { kind: "blocked", status: res.status, reason: `HTTP ${res.status}` };
    }
    if (!res.ok) {
      return { kind: "error", error: `HTTP ${res.status} ${res.statusText}` };
    }
    const html = await res.text();
    // Heurísticas de anti-bot / captcha
    if (/cf-chl-bypass|cloudflare|captcha|just a moment|datadome|please verify you are human/i.test(html.slice(0, 5000))) {
      return { kind: "blocked", status: res.status, reason: "Anti-bot detectado" };
    }
    return { kind: "ok", html, status: res.status, finalUrl: res.url };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { kind: "error", error: "timeout" };
    return { kind: "error", error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}
