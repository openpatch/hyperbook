import { describe, it, expect } from "vitest";
import config from "../lib/config.js";

// A production server that boots with the placeholder secret issues tokens
// anyone who has read the repository can forge, and says nothing about it. The
// point of these checks is that the failure is loud and happens before the
// first request.

/** A production environment with everything set correctly. */
function goodProduction(overrides = {}) {
  return {
    NODE_ENV: "production",
    JWT_SECRET: "x".repeat(48),
    BASE_URL: "https://cloud.example.com",
    ...overrides,
  };
}

describe("development", () => {
  it("accepts an empty environment", () => {
    expect(config.check({})).toEqual([]);
  });

  it("tolerates the placeholder secret", () => {
    // The defaults are what make `npm run dev` work with no setup.
    expect(
      config.check({
        NODE_ENV: "development",
        JWT_SECRET: config.PLACEHOLDER_SECRET,
      }),
    ).toEqual([]);
  });
});

describe("production", () => {
  it("accepts a correctly configured environment", () => {
    expect(config.check(goodProduction())).toEqual([]);
  });

  it("rejects the placeholder secret", () => {
    const problems = config.check(
      goodProduction({ JWT_SECRET: config.PLACEHOLDER_SECRET }),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/placeholder/);
  });

  it("rejects a missing secret", () => {
    const problems = config.check(goodProduction({ JWT_SECRET: undefined }));

    expect(problems.join()).toMatch(/JWT_SECRET is not set/);
  });

  it("rejects a secret too short to be worth having", () => {
    const problems = config.check(goodProduction({ JWT_SECRET: "short" }));

    expect(problems.join()).toMatch(/only 5 characters/);
  });

  it("suggests a usable secret rather than just complaining", () => {
    const problems = config.check(goodProduction({ JWT_SECRET: undefined }));
    const suggested = problems[0].match(/JWT_SECRET=([0-9a-f]+)/)[1];

    expect(suggested.length).toBeGreaterThanOrEqual(config.MIN_SECRET_LENGTH);
    // A fresh one each time, so copying the example is still safe.
    expect(config.suggestSecret()).not.toBe(suggested);
  });

  it("rejects a missing BASE_URL", () => {
    const problems = config.check(goodProduction({ BASE_URL: undefined }));

    expect(problems.join()).toMatch(/BASE_URL/);
  });

  it("reports every problem at once", () => {
    // So an operator fixes them in one pass instead of one restart each.
    const problems = config.check({ NODE_ENV: "production" });

    expect(problems).toHaveLength(2);
  });
});

describe("SMTP", () => {
  it("accepts email being switched off entirely", () => {
    expect(config.check(goodProduction())).toEqual([]);
  });

  it("accepts a complete configuration", () => {
    expect(
      config.check(
        goodProduction({
          SMTP_HOST: "smtp.example.com",
          SMTP_USER: "noreply@example.com",
          SMTP_PASS: "secret",
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a half-configured one, which silently sends nothing", () => {
    const problems = config.check(
      goodProduction({ SMTP_HOST: "smtp.example.com" }),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/SMTP_USER, SMTP_PASS missing/);
  });
});

describe("assertUsable", () => {
  it("throws with every problem in the message", () => {
    expect(() =>
      config.assertUsable({ NODE_ENV: "production" }),
    ).toThrow(/JWT_SECRET[\s\S]*BASE_URL/);
  });

  it("stays silent when the configuration is usable", () => {
    expect(() => config.assertUsable(goodProduction())).not.toThrow();
  });
});
