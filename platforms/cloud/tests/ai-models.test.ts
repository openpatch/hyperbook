import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { loggedIn, setup, type Instance } from "./helpers";

/*
 * The settings' model pick list: what the provider answers to
 * GET /api/instance/ai/models (sorted, deduplicated, cached), what happens
 * when it does not answer or is not configured, and that the assistant
 * stays off until a model is picked — in the settings or the environment's
 * shorthand.
 */

type Stub = { url: string; requests: number; close: () => Promise<void> };
const stubs: Stub[] = [];
afterEach(async () => {
  for (const stub of stubs.splice(0)) await stub.close();
});

/** A provider answering GET /v1/models with the given ids. */
function stubModels(ids: string[]): Stub {
  return stubModelsRaw(ids.map((id) => ({ id })));
}

/** A provider answering GET /v1/models with full entries (id, pricing, …). */
function stubModelsRaw(entries: Record<string, unknown>[]): Stub {
  const stub: Stub = {
    url: "",
    requests: 0,
    close: () => Promise.reject(new Error("not listening yet")),
  };
  const app = new Hono();
  app.get("/v1/models", (c) => {
    stub.requests += 1;
    return c.json({ data: entries });
  });
  const server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  stub.url =
    typeof address === "object" && address
      ? `http://localhost:${address.port}/v1`
      : "";
  stub.close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  stubs.push(stub);
  return stub;
}

/**
 * A models.dev-style catalog (api.json shape). Pass null and close it at once
 * for a URL that refuses connections.
 */
function stubCatalog(body: Record<string, unknown> | null): Stub {
  const stub: Stub = {
    url: "",
    requests: 0,
    close: () => Promise.reject(new Error("not listening yet")),
  };
  const app = new Hono();
  app.get("/api.json", (c) => {
    stub.requests += 1;
    return c.json(body ?? {});
  });
  const server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  stub.url =
    typeof address === "object" && address
      ? `http://localhost:${address.port}/api.json`
      : "";
  stub.close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  stubs.push(stub);
  if (body === null) void stub.close();
  return stub;
}

async function adminClient(instance: Instance) {
  return loggedIn(instance, {
    email: "admin@example.org",
    role: "admin",
  }).then(({ c }) => c);
}

describe("the settings' model pick list", () => {
  it("lists the provider's models, sorted and deduplicated, and caches briefly", async () => {
    const stub = stubModels([
      "zai-glm-5-3",
      "mistral-small-2603",
      "mistral-small-2603",
    ]);
    const instance = setup({ AI_BASE_URL: stub.url, AI_API_KEY: "key" });
    const c = await adminClient(instance);
    const first = await c.get("/api/instance/ai/models");
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      models: ["mistral-small-2603", "zai-glm-5-3"],
    });
    // The list is a hint for the settings page, not a live dependency.
    const second = await c.get("/api/instance/ai/models");
    expect(second.body).toEqual(first.body);
    expect(stub.requests).toBe(1);
  });

  it("answers 502 when the provider does not list its models", async () => {
    const stub = stubModels(["m"]);
    await stub.close(); // nothing listens there anymore
    const instance = setup({ AI_BASE_URL: stub.url, AI_API_KEY: "key" });
    const c = await adminClient(instance);
    const res = await c.get("/api/instance/ai/models");
    expect(res.status).toBe(502);
  });

  it("answers 503 when the provider is not configured", async () => {
    const instance = setup();
    const c = await adminClient(instance);
    const res = await c.get("/api/instance/ai/models");
    expect(res.status).toBe(503);
  });

  it("fetches prices from the provider's /models pricing (USD per token → €/M)", async () => {
    const stub = stubModelsRaw([
      {
        id: "mistral-small-2603",
        pricing: { prompt: "0.00000015", completion: "0.0000006", input_cache_read: "0.000000015" },
      },
      { id: "no-pricing-model" },
    ]);
    const instance = setup({ AI_BASE_URL: stub.url, AI_API_KEY: "key" });
    const c = await adminClient(instance);
    const res = await c.get("/api/instance/ai/prices");
    expect(res.status).toBe(200);
    // 0.15/0.015/0.60 USD per M × 0.92 EUR/USD.
    expect(res.body.prices).toEqual({
      "mistral-small-2603": { in: 0.138, cached: 0.0138, out: 0.552 },
    });
  });

  it("falls back to a models.dev-style catalog when the provider lists no prices", async () => {
    const stub = stubModels(["mistral-small-2603"]);
    const catalog = stubCatalog({
      mistral: {
        models: {
          "mistral-small-2603": { cost: { input: 0.15, output: 0.6, cache_read: 0.015 } },
        },
      },
    });
    const instance = setup({
      AI_BASE_URL: stub.url,
      AI_API_KEY: "key",
      AI_PRICES_URL: catalog.url,
    });
    const c = await adminClient(instance);
    const res = await c.get("/api/instance/ai/prices");
    expect(res.status).toBe(200);
    expect(res.body.prices).toEqual({
      "mistral-small-2603": { in: 0.138, cached: 0.0138, out: 0.552 },
    });
    expect(catalog.requests).toBe(1);
  });

  it("answers 502 when no price source answers", async () => {
    const stub = stubModels(["mistral-small-2603"]);
    const dead = stubCatalog(null); // closes immediately: connection refused
    const instance = setup({
      AI_BASE_URL: stub.url,
      AI_API_KEY: "key",
      AI_PRICES_URL: dead.url,
    });
    const c = await adminClient(instance);
    expect((await c.get("/api/instance/ai/prices")).status).toBe(502);
  });

  it("keeps the assistant off until the settings pick models", async () => {
    const stub = stubModels(["mistral-small-2603", "zai-glm-5-3"]);
    const instance = setup({ AI_BASE_URL: stub.url, AI_API_KEY: "key" });
    const c = await adminClient(instance);
    const { c: teacher } = await loggedIn(instance, {
      email: "teacher@example.org",
    });

    // The provider is configured, but no model was picked anywhere: the
    // assistant is off, and the settings still offer the section to pick one.
    expect((await teacher.get("/api/ai")).body.enabled).toBe(false);
    const settings = await c.get("/api/instance");
    expect(settings.body.ai.configured).toBe(true);
    expect(settings.body.ai.models).toEqual([]);

    // The settings pick the models, prices, names and the default. With
    // 1 credit = 1 µ€ and no buffer, a price of 9.33 €/M weighs 9.33.
    const put = await c.put("/api/instance", {
      aiModels: [
        { id: "mistral-small-2603", prices: { in: 1, cached: 1, out: 1 } },
        {
          id: "zai-glm-5-3",
          prices: { in: 9.33, cached: 9.33, out: 7.33 },
          label: "Gründlich",
        },
      ],
      aiDefaultModel: "zai-glm-5-3",
      aiCreditValueEur: 0.000001,
      aiCostBuffer: 1,
    });
    expect(put.status).toBe(200);

    const on = await teacher.get("/api/ai");
    expect(on.body.enabled).toBe(true);
    expect(on.body.model).toBe("zai-glm-5-3");
    expect(on.body.models).toEqual(["zai-glm-5-3", "mistral-small-2603"]);
    expect(on.body.modelLabels).toEqual({ "zai-glm-5-3": "Gründlich" });
    expect(on.body.modelWeights).toEqual({
      "zai-glm-5-3": { in: 9.33, cached: 9.33, out: 7.33 },
      "mistral-small-2603": { in: 1, cached: 1, out: 1 },
    });
  });

  it("turns the assistant on through the environment's shorthand", async () => {
    const stub = stubModels(["mistral-small-2603"]);
    const instance = setup({
      AI_BASE_URL: stub.url,
      AI_API_KEY: "key",
      AI_MODEL: "mistral-small-2603",
    });
    const { c: teacher } = await loggedIn(instance, {
      email: "teacher@example.org",
    });
    const res = await teacher.get("/api/ai");
    expect(res.body.enabled).toBe(true);
    expect(res.body.model).toBe("mistral-small-2603");
  });
});
