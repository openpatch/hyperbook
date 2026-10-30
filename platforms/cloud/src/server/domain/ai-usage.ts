import { eq, and, gte, lte, sql } from "drizzle-orm";
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

/** A model's weight for the token quota; a model without one weighs 1. */
export function modelWeight(
  weights: Record<string, number>,
  model: string,
): number {
  return weights[model] ?? 1;
}

/**
 * Adds what one provider call used to today's row and answers the week's
 * new weighted total. Weighted tokens are stored next to the raw counts, so
 * changing a weight later does not rewrite what was already spent.
 */
export function addTokens(
  db: Db,
  userId: number,
  tokensIn: number,
  tokensOut: number,
  weight: number,
): number {
  const weighted = Math.ceil((tokensIn + tokensOut) * weight);
  db.insert(aiUsage)
    .values({
      userId,
      day: today(),
      requests: 0,
      tokensIn,
      tokensOut,
      weightedTokens: weighted,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        tokensIn: sql`${aiUsage.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${aiUsage.tokensOut} + ${tokensOut}`,
        weightedTokens: sql`${aiUsage.weightedTokens} + ${weighted}`,
      },
    })
    .run();
  return usedThisWeek(db, userId);
}
