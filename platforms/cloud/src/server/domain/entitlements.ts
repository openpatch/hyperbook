import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client";
import { entitlements } from "../db/schema";
import { parseJson } from "../json";
import { getInstanceSettings } from "./instance";

/**
 * What a teacher may do beyond the basics. An admin sets them per user; a
 * later subscription system writes the same rows. A user without a row for a
 * key gets the instance default (instance settings), and admins are never
 * limited.
 */
export const entitlementsSchema = z.object({
  /** May set a book's visibility to private. */
  private_books: z.boolean(),
  /** How many books the user may own; null is unlimited. */
  max_books: z.number().int().min(0).nullable(),
  /** Storage for all owned books, in MB; null is unlimited. Enforced from M1. */
  max_storage_mb: z.number().int().min(0).nullable(),
  /** May attach a custom domain to a book. Used from M5. */
  custom_domain: z.boolean(),
  /** May use the editor's AI writing assistant (needs AI_* configured). */
  ai: z.boolean(),
  /** AI requests per UTC day; null is unlimited. The per-minute rate limit applies either way. */
  ai_requests_per_day: z.number().int().min(0).nullable(),
  /** Weighted AI tokens per UTC week (Monday to Sunday); null is unlimited. */
  ai_tokens_per_week: z.number().int().min(0).nullable(),
});

export type Entitlements = z.infer<typeof entitlementsSchema>;
export type EntitlementKey = keyof Entitlements;

export const ENTITLEMENT_KEYS = Object.keys(
  entitlementsSchema.shape,
) as EntitlementKey[];

export const BUILTIN_ENTITLEMENTS: Entitlements = {
  private_books: false,
  max_books: null,
  max_storage_mb: null,
  custom_domain: false,
  ai: true,
  ai_requests_per_day: null,
  ai_tokens_per_week: null,
};

const UNLIMITED: Entitlements = {
  private_books: true,
  max_books: null,
  max_storage_mb: null,
  custom_domain: true,
  ai: true,
  ai_requests_per_day: null,
  ai_tokens_per_week: null,
};

/** Only the keys set on the user itself, without defaults. */
export function getUserEntitlementOverrides(
  db: Db,
  userId: number,
): Partial<Entitlements> {
  const rows = db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .all();
  const overrides: Record<string, unknown> = {};
  for (const row of rows) {
    const field = entitlementsSchema.shape[row.key as EntitlementKey];
    // Rows for keys that no longer exist, or with values that no longer fit,
    // are ignored rather than breaking the user's account.
    const parsed = field?.safeParse(parseJson(row.value));
    if (parsed?.success) overrides[row.key] = parsed.data;
  }
  return overrides as Partial<Entitlements>;
}

export function getEntitlements(
  db: Db,
  user: { id: number; role: "admin" | "teacher" },
): Entitlements {
  if (user.role === "admin") return UNLIMITED;
  return {
    ...BUILTIN_ENTITLEMENTS,
    ...getInstanceSettings(db).defaultEntitlements,
    ...getUserEntitlementOverrides(db, user.id),
  };
}

/**
 * Replaces the user's overrides. Keys given as undefined fall back to the
 * instance default.
 */
export function setUserEntitlementOverrides(
  db: Db,
  userId: number,
  overrides: Partial<Entitlements>,
) {
  db.transaction((tx) => {
    tx.delete(entitlements).where(eq(entitlements.userId, userId)).run();
    for (const key of ENTITLEMENT_KEYS) {
      const value = overrides[key];
      if (value === undefined) continue;
      tx.insert(entitlements)
        .values({ userId, key, value: JSON.stringify(value) })
        .run();
    }
  });
}
