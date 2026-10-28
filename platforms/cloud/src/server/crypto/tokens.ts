import { createHash, randomBytes, randomInt } from "node:crypto";

/** An unguessable token for cookies, links and QR codes (256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** For high-entropy tokens only; passwords go through auth/password.ts. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** No look-alikes (0/o, 1/l/i), so printed credentials can be typed reliably. */
export const READABLE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function readableSecret(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += READABLE_ALPHABET[randomInt(READABLE_ALPHABET.length)];
  }
  return out;
}
