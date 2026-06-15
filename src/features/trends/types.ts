import type { TrendSource } from "@prisma/client";

export type NormalizedTrend = {
  name: string;
  query: string;
  rank: number;
  volume?: number | null;
  url?: string | null;
  meta?: Record<string, unknown>;
};

export type TrendListOutcome =
  | { kind: "ok"; trends: NormalizedTrend[] }
  | { kind: "blocked"; reason: string }
  | { kind: "error"; error: string };

export interface TrendProvider {
  readonly source: TrendSource;
  readonly experimental?: boolean;
  available(): boolean;
  fetchTrends(opts: { locale: string; limit?: number }): Promise<TrendListOutcome>;
}

export type TrendDTO = {
  id: string;
  name: string;
  source: TrendSource;
  query: string;
  locale: string;
  rank: number;
  volume: number | null;
  url: string | null;
  updatedAt: string;
};

