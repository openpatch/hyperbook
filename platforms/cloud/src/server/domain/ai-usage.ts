import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { ModelWeights } from "../../shared/schemas";
import type { Db } from "../db/client";
import { aiUsage } from "../db/schema";

/*
 * The AI assistant's daily quota counter. A quota (entitlement
 * `ai_requests_per_day`, `ai_tokens_per_week`) is enforced state, so it lives in its own table,
 * not in the audit log, whose entries are history. Days are UTC, so "per
 * day" means the same for every teacher of an instance.
 */

/** Today as a UTC day key. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The current UTC week, Monday to Sunday, as day keys; `resets` is the next Monday. */
export function currentWeek(now = new Date()): {
  from: string;
  to: string;
  resets: string;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 7);
  return { from: dayKey(start), to: dayKey(end), resets: dayKey(next) };
}

/** How many requests the user has made today. */
export function usedToday(db: Db, userId: number): number {
  return (
    db
      .select({ requests: aiUsage.requests })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, today())))
      .get()?.requests ?? 0
  );
}

/**
 * Counts one request and answers the day's new total. Called when a request
 * is accepted — a request the provider then fails has been made all the
 * same, and counting it keeps the quota a real limit.
 */
export function countRequest(db: Db, userId: number): number {
  db.insert(aiUsage)
    .values({ userId, day: today(), requests: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { requests: sql`${aiUsage.requests} + 1` },
    })
    .run();
  return usedToday(db, userId);
}

/** The weighted tokens the user has used in the current UTC week. */
export function usedThisWeek(db: Db, userId: number): number {
  const { from, to } = currentWeek();
  return (
    db
      .select({ total: sql<number>`coalesce(sum(${aiUsage.weightedTokens}), 0)` })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          gte(aiUsage.day, from),
          lte(aiUsage.day, to),
        ),
      )
      .get()?.total ?? 0
  );
}

/**
 * A model's weights for the token quota, one per token kind; a model
 * without an entry weighs 1 for all three.
 */
export function modelWeights(
  weights: Record<string, ModelWeights>,
  model: string,
): ModelWeights {
  return weights[model] ?? { in: 1, cached: 1, out: 1 };
}

/**
 * Adds what one provider call used to today's row and answers the week's
 * new weighted total. Each token kind counts at its own weight — cached
 * prompt tokens (a subset of the input tokens) at the cached weight, so a
 * prefix-cache hit costs less than a fresh input token. Weighted tokens are
 * stored next to the raw counts, so changing a weight later does not
 * rewrite what was already spent.
 */
export function addTokens(
  db: Db,
  userId: number,
  tokensIn: number,
  tokensCached: number,
  tokensOut: number,
  weights: ModelWeights,
): number {
  // Cached tokens are a subset of the prompt tokens, billed at their own
  // (lower) rate — so only the uncached remainder counts at the input weight.
  const cached = Math.min(Math.max(tokensCached, 0), tokensIn);
  const weighted = Math.ceil(
    (tokensIn - cached) * weights.in +
      cached * weights.cached +
      tokensOut * weights.out,
  );
  db.insert(aiUsage)
    .values({
      userId,
      day: today(),
      requests: 0,
      tokensIn,
      tokensCached,
      tokensOut,
      weightedTokens: weighted,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        tokensIn: sql`${aiUsage.tokensIn} + ${tokensIn}`,
        tokensCached: sql`${aiUsage.tokensCached} + ${tokensCached}`,
        tokensOut: sql`${aiUsage.tokensOut} + ${tokensOut}`,
        weightedTokens: sql`${aiUsage.weightedTokens} + ${weighted}`,
      },
    })
    .run();
  return usedThisWeek(db, userId);
}
