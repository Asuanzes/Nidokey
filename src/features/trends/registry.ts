import type { TrendProvider } from "@/features/trends/types";
import { twitterTrendProvider } from "@/features/trends/providers/twitter";
import { googleTrendsProvider } from "@/features/trends/providers/googletrends";
import { hackerNewsProvider } from "@/features/trends/providers/hackernews";
import { twitchProvider } from "@/features/trends/providers/twitch";

/**
 * Fuentes de tendencias activas (todas keyless). X/Twitter (trends24+Jina) y
 * Google Trends (RSS oficial) son fiables; Twitch es best-effort vía Jina y
 * degrada a blocked/error sin tumbar al resto.
 *
 * Instagram NO está en la lista: su /explore/ tiene muro de login y solo
 * devuelve `blocked`. El provider (`providers/instagram.ts`) se conserva listo
 * por si algún día es alcanzable keyless; reincorporarlo = añadirlo aquí.
 *
 * Se retiraron los providers experimentales sin fuente viva (reddit, linkedin,
 * xiaohongshu, xueqiu, tiktok, youtube): no eran scrapeables sin login/clave.
 * Sus valores siguen en el enum TrendSource (inofensivos), pero ya no se
 * consultan ni se muestran chips de filtro para ellos.
 */
export const TREND_PROVIDERS: TrendProvider[] = [
  twitterTrendProvider,
  googleTrendsProvider,
  hackerNewsProvider,
  twitchProvider,
];
