import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { twitterTrendProvider } from "./twitter";

const originalFetch = globalThis.fetch;
const originalKey = process.env.TWITTERAPI_IO_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.TWITTERAPI_IO_KEY = originalKey;
  delete process.env.TWITTERAPI_IO_TRENDS_URL;
});

test("twitter provider devuelve blocked sin credenciales", async () => {
  delete process.env.TWITTERAPI_IO_KEY;
  const out = await twitterTrendProvider.fetchTrends({ locale: "ES" });
  assert.equal(out.kind, "blocked");
});

test("twitter provider normaliza respuesta ok", async () => {
  process.env.TWITTERAPI_IO_KEY = "test-key";
  process.env.TWITTERAPI_IO_TRENDS_URL = "https://example.test/trends";
  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), "https://example.test/trends?woeid=23424950");
    return new Response(JSON.stringify({ trends: [{ name: "#FelizLunes", tweet_volume: 42 }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const out = await twitterTrendProvider.fetchTrends({ locale: "ES" });
  assert.equal(out.kind, "ok");
  if (out.kind === "ok") {
    assert.equal(out.trends[0].name, "#FelizLunes");
    assert.equal(out.trends[0].query, "Feliz Lunes");
    assert.equal(out.trends[0].volume, 42);
  }
});

test("twitter provider traduce HTTP upstream a blocked", async () => {
  process.env.TWITTERAPI_IO_KEY = "test-key";
  globalThis.fetch = (async () => new Response("rate limit", { status: 429 })) as typeof fetch;
  const out = await twitterTrendProvider.fetchTrends({ locale: "WORLD" });
  assert.equal(out.kind, "blocked");
});

