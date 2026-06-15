import type { TrendProvider } from "@/features/trends/types";
import { twitterTrendProvider } from "@/features/trends/providers/twitter";
import { redditTrendProvider } from "@/features/trends/providers/reddit";
import { experimentalProvider } from "@/features/trends/providers/experimental";

export const TREND_PROVIDERS: TrendProvider[] = [
  twitterTrendProvider,
  redditTrendProvider,
  experimentalProvider("linkedin"),
  experimentalProvider("xiaohongshu"),
  experimentalProvider("xueqiu"),
  experimentalProvider("instagram"),
  experimentalProvider("tiktok"),
  experimentalProvider("youtube"),
];

