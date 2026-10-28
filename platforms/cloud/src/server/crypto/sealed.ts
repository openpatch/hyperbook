import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Encrypts values that must be shown again later (student passwords and login
 * keys, for reprinting) with AES-256-GCM under CREDENTIALS_KEY.
 *
 * Format:  k1.<iv b64url>.<ciphertext b64url>.<tag b64url>
 * The key id ("k1") leaves room to rotate CREDENTIALS_KEY later.
 */

const KEY_ID = "k1";

export function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    KEY_ID,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

/** Returns null when the value was sealed with another key or was tampered with. */
export function open(key: Buffer, sealed: string): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== KEY_ID) return null;
  const [, iv, ciphertext, tag] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
