import { describe, expect, it } from "vitest";
import { ConfigError, bookOrigin, loadConfig } from "../src/server/config";

const KEY = Buffer.alloc(32, 1).toString("base64");

const production = {
  NODE_ENV: "production",
  ADMIN_ORIGIN: "https://cloud.example.org",
  BOOKS_DOMAIN: "example.page",
  CREDENTIALS_KEY: KEY,
  DATA_DIR: "/data",
};

function problems(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  return [];
}

describe("loadConfig", () => {
  it("runs in development without any setup", () => {
    const config = loadConfig({});
    expect(config.env).toBe("development");
    expect(config.adminHost).toBe("localhost:5173");
    expect(config.booksDomain).toBe("books.localhost:3001");
    expect(config.credentialsKey).toHaveLength(32);
  });

  it("accepts a complete production configuration", () => {
    const config = loadConfig(production);
    expect(config.adminOrigin).toBe("https://cloud.example.org");
    expect(config.adminHost).toBe("cloud.example.org");
    expect(bookOrigin(config, "physics")).toBe("https://physics.example.page");
  });

  it("requires origin, books domain and key in production", () => {
    const found = problems({ NODE_ENV: "production" });
    expect(found.join("\n")).toMatch(/ADMIN_ORIGIN is required/);
    expect(found.join("\n")).toMatch(/BOOKS_DOMAIN is required/);
    expect(found.join("\n")).toMatch(/CREDENTIALS_KEY is required/);
  });

  it("requires https in production", () => {
    expect(
      problems({ ...production, ADMIN_ORIGIN: "http://cloud.example.org" }),
    ).toEqual(["ADMIN_ORIGIN must use https:// in production"]);
  });

  it("rejects an origin with a path", () => {
    expect(
      problems({ ...production, ADMIN_ORIGIN: "https://example.org/cloud" })[0],
    ).toMatch(/origin only/);
  });

  it("rejects a books domain that would serve the admin host as a book", () => {
    expect(
      problems({ ...production, BOOKS_DOMAIN: "example.org" })[0],
    ).toMatch(/lies inside BOOKS_DOMAIN/);
  });

  it("allows books on a sibling subdomain of the admin host", () => {
    expect(problems({ ...production, BOOKS_DOMAIN: "books.example.org" })).toEqual([]);
  });

  it("allows books below the admin host (admin on the bare domain)", () => {
    expect(
      problems({ ...production, ADMIN_ORIGIN: "https://example.org", BOOKS_DOMAIN: "example.org" }),
    ).toEqual([]);
  });

  it("rejects a books domain with a scheme", () => {
    expect(
      problems({ ...production, BOOKS_DOMAIN: "https://example.page" })[0],
    ).toMatch(/bare host name/);
  });

  it("rejects a key of the wrong length", () => {
    expect(
      problems({ ...production, CREDENTIALS_KEY: Buffer.alloc(16).toString("base64") }),
    ).toEqual(["CREDENTIALS_KEY must be 32 bytes, base64-encoded"]);
  });

  it("rejects half an SMTP configuration", () => {
    expect(problems({ ...production, SMTP_HOST: "mail.example.org" })[0]).toMatch(
      /also set SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM/,
    );
  });

  it("configures AI from the provider pair alone", () => {
    // Nothing set: the feature is simply off.
    expect(loadConfig(production).ai).toBeNull();
    // The provider pair is enough: the admin settings pick the models. Without
    // any — shorthand or settings — there is no model, so no assistant.
    const pair = loadConfig({
      ...production,
      AI_BASE_URL: "https://api.mistral.ai/v1/",
      AI_API_KEY: "key",
      AI_REQUESTS_PER_MINUTE: "3",
    });
    expect(pair.ai).toEqual({
      baseUrl: "https://api.mistral.ai/v1",
      apiKey: "key",
      model: null,
      models: [],
      timeoutMs: 120_000,
      maxOutputTokens: 8192,
      maxSteps: 6,
      requestsPerMinute: 3,
      modelWeights: {},
    });
    // The shorthand still names the models; AI_MODEL stays the default.
    const config = loadConfig({
      ...production,
      AI_BASE_URL: "https://api.mistral.ai/v1/",
      AI_API_KEY: "key",
      AI_MODEL: "mistral-medium-latest",
      AI_REQUESTS_PER_MINUTE: "3",
    });
    expect(config.ai).toEqual({
      ...pair.ai,
      model: "mistral-medium-latest",
      models: ["mistral-medium-latest"],
    });
  });

  it("parses AI_MODEL_WEIGHTS and rejects bad ones", () => {
    const base = {
      ...production,
      AI_BASE_URL: "https://api.mistral.ai/v1",
      AI_API_KEY: "key",
      AI_MODEL: "small",
      AI_MODELS: "big",
    };
    expect(
      loadConfig({ ...base, AI_MODEL_WEIGHTS: "big=3, small=0.5" }).ai
        ?.modelWeights,
    ).toEqual({
      big: { in: 3, cached: 3, out: 3 },
      small: { in: 0.5, cached: 0.5, out: 0.5 },
    });
    // Per-kind weights: model=in/cached/out.
    expect(
      loadConfig({ ...base, AI_MODEL_WEIGHTS: "big=4.67/4.67/3.5" }).ai
        ?.modelWeights,
    ).toEqual({ big: { in: 4.67, cached: 4.67, out: 3.5 } });
    expect(() => loadConfig({ ...base, AI_MODEL_WEIGHTS: "big=0" })).toThrow();
    expect(() => loadConfig({ ...base, AI_MODEL_WEIGHTS: "big=1/2" })).toThrow();
    expect(() =>
      loadConfig({ ...base, AI_MODEL_WEIGHTS: "unknown=2" }),
    ).toThrow();
  });

  it("parses AI_MODELS into the selectable list, default first, without duplicates", () => {
    const config = loadConfig({
      ...production,
      AI_BASE_URL: "https://api.mistral.ai/v1",
      AI_API_KEY: "key",
      AI_MODEL: "mistral-medium-latest",
      AI_MODELS: "mistral-small-latest, mistral-medium-latest ,open-mistral-nemo,",
    });
    expect(config.ai?.model).toBe("mistral-medium-latest");
    expect(config.ai?.models).toEqual([
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mistral-nemo",
    ]);
  });

  it("rejects half an AI configuration and bad URLs", () => {
    expect(problems({ ...production, AI_BASE_URL: "https://api.mistral.ai/v1" })[0]).toMatch(
      /AI is partly configured; also set AI_API_KEY/,
    );
    expect(
      problems({ ...production, AI_BASE_URL: "api.mistral.ai/v1", AI_API_KEY: "k", AI_MODEL: "m" }),
    ).toEqual(["AI_BASE_URL is not a valid URL: api.mistral.ai/v1"]);
    expect(
      problems({
        ...production,
        AI_BASE_URL: "ftp://api.mistral.ai",
        AI_API_KEY: "k",
        AI_MODEL: "m",
      })[0],
    ).toMatch(/must start with http/);
  });

  it("requires the first admin's email and password together", () => {
    expect(problems({ ...production, ADMIN_EMAIL: "a@example.org" })).toEqual([
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set together",
    ]);
  });
});

describe("development defaults", () => {
  it("follow PORT and WEB_PORT", () => {
    const config = loadConfig({ PORT: "3101", WEB_PORT: "5273" });
    expect(config.adminOrigin).toBe("http://localhost:5273");
    expect(config.booksDomain).toBe("books.localhost:3101");
  });
});
