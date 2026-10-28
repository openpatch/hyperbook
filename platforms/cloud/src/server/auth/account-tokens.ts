import { and, eq, gt, isNull } from "drizzle-orm";
import { randomToken, sha256 } from "../crypto/tokens";
import type { Db } from "../db/client";
import { passwordResets } from "../db/schema";

/*
 * One-time links sent by email. Only the token's hash is stored.
 *
 *   reset   choose a new password (1 hour)
 *   verify  confirm the address of a new sign-up (24 hours)
 *   invite  an admin added you: choose a password (7 days)
 *
 * Setting a password through a reset or an invitation confirms the address
 * as well: the link reached it.
 */

export type TokenPurpose = "reset" | "verify" | "invite";

export const TOKEN_LIFETIME_MS: Record<TokenPurpose, number> = {
  reset: 60 * 60 * 1000,
  verify: 24 * 60 * 60 * 1000,
  invite: 7 * 24 * 60 * 60 * 1000,
};

export function createAccountToken(db: Db, userId: number, purpose: TokenPurpose, now = Date.now()): string {
  const token = randomToken();
  db.insert(passwordResets)
    .values({ tokenHash: sha256(token), userId, purpose, expiresAt: new Date(now + TOKEN_LIFETIME_MS[purpose]) })
    .run();
  return token;
}

/** The unused, unexpired token of one of `purposes`, or null. Does not use it up. */
export function findAccountToken(db: Db, token: string, purposes: TokenPurpose[], now = Date.now()) {
  const row = db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, sha256(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date(now)),
      ),
    )
    .get();
  return row && purposes.includes(row.purpose) ? row : null;
}

export function useAccountToken(db: Db, tokenHash: string) {
  db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.tokenHash, tokenHash)).run();
}
