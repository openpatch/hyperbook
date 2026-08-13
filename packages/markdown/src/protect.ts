import crypto from "node:crypto";

/** Default PBKDF2 work factor. Kept in the payload so old pages keep working. */
export const DEFAULT_ITERATIONS = 250_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Encrypted content of a single protect block.
 *
 * Every field is base64 or a number. The payload is serialized into a
 * `<script>` body, whose content is raw text in hast — an unescaped `</script>`
 * sequence would break out of the tag.
 */
export type ProtectPayload = {
  v: 1;
  kdf: "PBKDF2-SHA256";
  /** PBKDF2 iterations. */
  it: number;
  /** base64, 16 bytes. */
  salt: string;
  /** base64, 12 bytes. */
  iv: string;
  /** base64, AES-256-GCM ciphertext followed by the 16 byte auth tag. */
  ct: string;
};

/**
 * Encrypts the rendered HTML of a protect block.
 *
 * Salt and iv are random per block per build. They cannot be derived from the
 * block id: `id` is a shared group key, so two blocks may carry the same id
 * with different content, and reusing an iv under one derived key would leak
 * both plaintexts. The cost is that builds are not byte-reproducible for
 * protected blocks.
 *
 * There is no separate password check — a wrong password fails the GCM auth
 * tag, so nothing password-derived has to be shipped.
 */
export const encryptHtml = (
  html: string,
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): ProtectPayload => {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = crypto.pbkdf2Sync(
    Buffer.from(password, "utf8"),
    salt,
    iterations,
    KEY_BYTES,
    "sha256",
  );

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(html, "utf8")),
    cipher.final(),
  ]);

  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    it: iterations,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ct: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("base64"),
  };
};

/**
 * Counterpart of {@link encryptHtml}, for tests. The browser does this with
 * `crypto.subtle`; see assets/directive-protect/client.js.
 */
export const decryptHtml = (
  payload: ProtectPayload,
  password: string,
): string => {
  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const body = Buffer.from(payload.ct, "base64");
  const ciphertext = body.subarray(0, body.length - 16);
  const authTag = body.subarray(body.length - 16);

  const key = crypto.pbkdf2Sync(
    Buffer.from(password, "utf8"),
    salt,
    payload.it,
    KEY_BYTES,
    "sha256",
  );

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};
