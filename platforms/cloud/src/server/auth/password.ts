import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/*
 * scrypt, from node:crypto, so there is no native dependency to build.
 * Stored as  scrypt$<log2 N>$<r>$<p>$<salt b64>$<hash b64>  so the cost can be
 * raised later without breaking existing hashes.
 */

export type HashCost = "account" | "student";

// Tests hash hundreds of passwords; HYPERBOOK_TEST_FAST_HASH (set only by the
// test runner) makes that cheap. Hashes record their cost, so verification is
// unaffected either way.
const FAST = process.env.HYPERBOOK_TEST_FAST_HASH === "1";

const COSTS: Record<HashCost, { logN: number; r: number; p: number }> = FAST
  ? { account: { logN: 10, r: 8, p: 1 }, student: { logN: 10, r: 8, p: 1 } }
  : {
      // Teachers and admins: OWASP's recommended scrypt parameters.
      account: { logN: 17, r: 8, p: 1 },
      // Student passwords are generated, low in value and recoverable by the
      // teacher anyway; a cheaper hash keeps generating a class fast.
      student: { logN: 14, r: 8, p: 1 },
    };

const KEY_LENGTH = 32;

function derive(
  password: string,
  salt: Buffer,
  logN: number,
  r: number,
  p: number,
): Promise<Buffer> {
  const N = 2 ** logN;
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFC"),
      salt,
      KEY_LENGTH,
      // scrypt needs 128 * N * r bytes; allow that plus headroom.
      { N, r, p, maxmem: 256 * N * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(
  password: string,
  cost: HashCost = "account",
): Promise<string> {
  const { logN, r, p } = COSTS[cost];
  const salt = randomBytes(16);
  const key = await derive(password, salt, logN, r, p);
  return [
    "scrypt",
    logN,
    r,
    p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, logN, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hash, "base64");
  const key = await derive(
    password,
    Buffer.from(salt, "base64"),
    Number(logN),
    Number(r),
    Number(p),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash nobody's password matches, to keep login timing the same for unknown emails. */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
