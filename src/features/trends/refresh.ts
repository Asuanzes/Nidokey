import type { TrendSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TREND_PROVIDERS } from "@/features/trends/registry";
import type { NormalizedTrend, TrendProvider } from "@/features/trends/types";

const DEFAULT_LOCALES = ["ES", "WORLD"];
const DEFAULT_LIMIT = 50;
const STALE_TTL_MS = 48 * 60 * 60 * 1000;

type TrendDb = {
  trend: {
    upsert(args: {
      where: { source_locale_name: { source: TrendSource; locale: string; name: string } };
      update: {
        query: string;
        rank: number;
        volume: number | null;
        url: string | null;
        meta: object | null;
        lastSeenAt: Date;
      };
      create: {
        source: TrendSource;
        locale: string;
        name: string;
        query: string;
        rank: number;
        volume: number | null;
        url: string | null;
        meta: object | null;
        lastSeenAt: Date;
      };
    }): Promise<unknown>;
    deleteMany(args: {
      where: {
        lastSeenAt: { lt: Date };
        OR: { source: TrendSource; locale: string }[];
      };
    }): Promise<{ count: number }>;
  };
};

export type RefreshTrendsSummary = {
  checkedProviders: number;
  locales: string[];
  upserted: number;
  purged: number;
  blocked: number;
  errors: number;
  details: { source: TrendSource; locale: string; kind: "ok" | "blocked" | "error"; count?: number; message?: string }[];
};

function cleanTrend(t: NormalizedTrend): NormalizedTrend | null {
  const name = t.name.trim();
  const query = t.query.trim();
  if (!name || !query) return null;
  return {
    ...t,
    name,
    query,
    rank: Number.isFinite(t.rank) ? Math.max(1, Math.round(t.rank)) : 9999,
    volume: typeof t.volume === "number" && Number.isFinite(t.volume) ? Math.max(0, Math.round(t.volume)) : null,
    url: t.url ?? null,
  };
}

export async function refreshTrends(opts: {
  locales?: string[];
  source?: TrendSource | "all";
  providers?: TrendProvider[];
  db?: TrendDb;
  now?: Date;
  ttlMs?: number;
  limit?: number;
} = {}): Promise<RefreshTrendsSummary> {
  const locales = (opts.locales?.length ? opts.locales : DEFAULT_LOCALES).map((x) => x.toUpperCase());
  const providers = (opts.providers ?? TREND_PROVIDERS)
    .filter((p) => opts.source && opts.source !== "all" ? p.source === opts.source : true)
    .filter((p) => p.available());
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - (opts.ttlMs ?? STALE_TTL_MS));

  const summary: RefreshTrendsSummary = {
    checkedProviders: providers.length,
    locales,
    upserted: 0,
    purged: 0,
    blocked: 0,
    errors: 0,
    details: [],
  };
  const successfulPairs: { source: TrendSource; locale: string }[] = [];

  for (const provider of providers) {
    for (const locale of locales) {
      console.log(`[trends-refresh] fetching ${provider.source}/${locale}`);
      const outcome = await provider.fetchTrends({ locale, limit: opts.limit ?? DEFAULT_LIMIT });
      if (outcome.kind !== "ok") {
        if (outcome.kind === "blocked") summary.blocked++;
        else summary.errors++;
        const message = outcome.kind === "blocked" ? outcome.reason : outcome.error;
        console.log(`[trends-refresh] ${provider.source}/${locale} ${outcome.kind}: ${message}`);
        summary.details.push({ source: provider.source, locale, kind: outcome.kind, message });
        continue;
      }

      let count = 0;
      for (const raw of outcome.trends) {
        const t = cleanTrend(raw);
        if (!t) continue;
        await db.trend.upsert({
          where: { source_locale_name: { source: provider.source, locale, name: t.name } },
          update: {
            query: t.query,
            rank: t.rank,
            volume: t.volume ?? null,
            url: t.url ?? null,
            meta: t.meta ?? null,
            lastSeenAt: now,
          },
          create: {
            source: provider.source,
            locale,
            name: t.name,
            query: t.query,
            rank: t.rank,
            volume: t.volume ?? null,
            url: t.url ?? null,
            meta: t.meta ?? null,
            lastSeenAt: now,
          },
        });
        count++;
      }
      summary.upserted += count;
      successfulPairs.push({ source: provider.source, locale });
      summary.details.push({ source: provider.source, locale, kind: "ok", count });
      console.log(`[trends-refresh] ${provider.source}/${locale}: ${count} tendencias`);
    }
  }

  if (successfulPairs.length > 0) {
    const purged = await db.trend.deleteMany({
      where: { lastSeenAt: { lt: cutoff }, OR: successfulPairs },
    });
    summary.purged = purged.count;
    console.log(`[trends-refresh] purged stale=${summary.purged}`);
  }

  return summary;
}

