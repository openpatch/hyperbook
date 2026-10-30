import { eq, and, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { aiUsage } from "../db/schema";

/*
 * The AI assistant's daily quota counter. A quota (entitlement
 * `ai_requests_per_day`) is enforced state, so it lives in its own table,
 * not in the audit log, whose entries are history. Days are UTC, so "per
 * day" means the same for every teacher of an instance.
 */

/** Today as a UTC day key. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
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
