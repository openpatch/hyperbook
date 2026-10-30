/**
 * Counts failed logins per key (the email address) in memory. One process
 * serves the whole instance, so memory is enough. Keyed by account rather than
 * IP because behind a reverse proxy every request has the proxy's address.
 */
export class FailureLimiter {
  private failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  fail(key: string, now = Date.now()) {
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= now) {
      this.failures.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
  }

  succeed(key: string) {
    this.failures.delete(key);
  }
}

/**
 * Counts operations per key in a window, to keep one book's git traffic (or
 * one source) from hogging the server. Unlike FailureLimiter this counts
 * every call, not only failures.
 */
export class OpLimiter {
  private ops = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 120,
    private readonly windowMs = 60 * 1000,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.ops.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.ops.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  hit(key: string, now = Date.now()) {
    const entry = this.ops.get(key);
    if (!entry || entry.resetAt <= now) {
      this.ops.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
  }
}
