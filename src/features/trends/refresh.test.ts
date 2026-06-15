import { test } from "node:test";
import assert from "node:assert/strict";
import type { TrendProvider } from "./types";
import { refreshTrends } from "./refresh";

function provider(over: Partial<TrendProvider>): TrendProvider {
  return {
    source: "twitter",
    available: () => true,
    fetchTrends: async () => ({ kind: "ok", trends: [] }),
    ...over,
  } as TrendProvider;
}

test("refreshTrends upserta tendencias y purga solo pares refrescados con éxito", async () => {
  const upserts: unknown[] = [];
  let deleteArgs: any = null;
  const db = {
    trend: {
      upsert: async (args: unknown) => {
        upserts.push(args);
      },
      deleteMany: async (args: any) => {
        deleteArgs = args;
        return { count: 3 };
      },
    },
  };

  const ok = provider({
    source: "twitter",
    fetchTrends: async () => ({
      kind: "ok",
      trends: [{ name: "#FelizLunes", query: "Feliz Lunes", rank: 1, volume: 120, url: null }],
    }),
  });
  const failed = provider({
    source: "reddit",
    fetchTrends: async () => ({ kind: "error", error: "upstream down" }),
  });

  const summary = await refreshTrends({
    providers: [ok, failed],
    locales: ["ES"],
    db,
    now: new Date("2026-06-15T10:00:00Z"),
    ttlMs: 1000,
  });

  assert.equal(summary.upserted, 1);
  assert.equal(summary.errors, 1);
  assert.equal(summary.purged, 3);
  assert.equal(upserts.length, 1);
  assert.deepEqual(deleteArgs.where.OR, [{ source: "twitter", locale: "ES" }]);
});

test("refreshTrends conserva caché si todos los proveedores fallan", async () => {
  let purged = false;
  const db = {
    trend: {
      upsert: async () => {},
      deleteMany: async () => {
        purged = true;
        return { count: 0 };
      },
    },
  };
  const failed = provider({
    source: "twitter",
    fetchTrends: async () => ({ kind: "blocked", reason: "rate limit" }),
  });

  const summary = await refreshTrends({ providers: [failed], locales: ["ES"], db });
  assert.equal(summary.blocked, 1);
  assert.equal(summary.purged, 0);
  assert.equal(purged, false);
});

