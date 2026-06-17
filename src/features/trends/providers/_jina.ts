/**
 * Helper compartido para leer páginas públicas a través de Jina Reader
 * (https://r.jina.ai/<url>) — un simple GET, gratis y sin API key, que
 * devuelve la página renderizada como markdown. Lo usan los providers de
 * tendencias que scrapean fuentes sin endpoint JSON propio (Instagram, Twitch).
 *
 * El provider de X/Twitter mantiene su propia copia (no se toca) por estabilidad.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export async function fetchJinaText(targetUrl: string, timeoutMs = 20000): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
    headers: { "User-Agent": UA, Accept: "text/plain" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  return res.text();
}

/** Jina devuelve este texto cuando el dominio bloquea el acceso anónimo. */
export function isJinaBlocked(md: string): boolean {
  return /Anonymous access to domain .* blocked|SecurityCompromiseError|requires authentication/i.test(md);
}
