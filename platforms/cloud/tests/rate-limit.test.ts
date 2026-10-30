import { describe, expect, it } from "vitest";
import { FailureLimiter, OpLimiter } from "../src/server/auth/rate-limit";

describe("FailureLimiter", () => {
  it("blocks a key after max failures within the window, and forgets it afterwards", () => {
    const now = 1_000_000;
    const limiter = new FailureLimiter(3, 60_000);
    limiter.fail("a", now);
    limiter.fail("a", now);
    expect(limiter.isBlocked("a", now + 1)).toBe(false);
    limiter.fail("a", now);
    expect(limiter.isBlocked("a", now + 1)).toBe(true);
    expect(limiter.isBlocked("a", now + 61_000)).toBe(false);
    limiter.succeed("a");
    expect(limiter.isBlocked("a", now + 1)).toBe(false);
  });

  it("stays bounded when the keys are attacker-chosen", () => {
    const now = 1_000_000;
    const limiter = new FailureLimiter(2, 60_000, 10);
    for (let i = 0; i < 100; i++) {
      limiter.fail(`attacker-${i}`, now);
      limiter.fail(`attacker-${i}`, now);
    }
    // The newest keys are still blocked…
    expect(limiter.isBlocked("attacker-99", now)).toBe(true);
    // …but the map did not grow past maxKeys: the oldest keys were evicted.
    expect(limiter.isBlocked("attacker-0", now)).toBe(false);
  });
});

describe("OpLimiter", () => {
  it("blocks a key after max operations within the window only", () => {
    const now = 1_000_000;
    const limiter = new OpLimiter(2, 60_000);
    limiter.hit("book:1", now);
    expect(limiter.isBlocked("book:1", now)).toBe(false);
    limiter.hit("book:1", now);
    expect(limiter.isBlocked("book:1", now)).toBe(true);
    expect(limiter.isBlocked("book:1", now + 61_000)).toBe(false);
    expect(limiter.isBlocked("book:2", now)).toBe(false);
  });
});
