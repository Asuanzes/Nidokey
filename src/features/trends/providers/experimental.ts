import type { TrendSource } from "@prisma/client";
import type { TrendListOutcome, TrendProvider } from "@/features/trends/types";

const ENV_BY_SOURCE: Partial<Record<TrendSource, string>> = {
  linkedin: "OUTX_API_KEY",
  xiaohongshu: "XHS_PROVIDER_KEY",
  xueqiu: "XUEQIU_PROVIDER_KEY",
  instagram: "INSTAGRAM_PROVIDER_KEY",
  tiktok: "TIKTOK_PROVIDER_KEY",
  youtube: "YOUTUBE_PROVIDER_KEY",
};

export function experimentalProvider(source: TrendSource): TrendProvider {
  const env = ENV_BY_SOURCE[source];
  return {
    source,
    experimental: true,
    available() {
      return Boolean(env && process.env[env]);
    },
    async fetchTrends(): Promise<TrendListOutcome> {
      if (!env || !process.env[env]) return { kind: "blocked", reason: `${env ?? source} no configurado` };
      return { kind: "blocked", reason: `${source} experimental pendiente de implementación` };
    },
  };
}

