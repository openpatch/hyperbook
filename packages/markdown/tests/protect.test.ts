import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptHtml, encryptHtml, ProtectPayload } from "../src/protect";

const subtle = webcrypto.subtle;

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Mirrors assets/directive-protect/client.js exactly. If this drifts from the
 * client, protected content stops opening in the browser while every other
 * test still passes.
 */
const decryptWithWebCrypto = async (
  payload: ProtectPayload,
  password: string,
): Promise<string> => {
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: b64(payload.salt),
      iterations: payload.it,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: b64(payload.iv) },
    key,
    b64(payload.ct),
  );
  return new TextDecoder().decode(plaintext);
};

// Keep the work factor low so the suite stays fast; the KDF is the same.
const IT = 1000;

describe("protect", () => {
  const html = "<p>secret content</p><div class=\"x\">ünïcodé 🔒</div>";

  it("round-trips through node", () => {
    const payload = encryptHtml(html, "hyperbook", IT);
    expect(decryptHtml(payload, "hyperbook")).toBe(html);
  });

  it("decrypts in the browser with the client's parameters", async () => {
    const payload = encryptHtml(html, "hyperbook", IT);
    await expect(decryptWithWebCrypto(payload, "hyperbook")).resolves.toBe(html);
  });

  it("rejects a wrong password", async () => {
    const payload = encryptHtml(html, "hyperbook", IT);
    await expect(decryptWithWebCrypto(payload, "wrong")).rejects.toThrow();
    expect(() => decryptHtml(payload, "wrong")).toThrow();
  });

  it("never emits the plaintext or the password", () => {
    const payload = encryptHtml(html, "hyperbook", IT);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("secret content");
    expect(serialized).not.toContain("hyperbook");
    expect(serialized).not.toContain(btoa("hyperbook"));
  });

  it("uses a fresh salt and iv per block", () => {
    const a = encryptHtml(html, "hyperbook", IT);
    const b = encryptHtml(html, "hyperbook", IT);
    // Same content, same password, same shared id: the ciphertext must still
    // differ, otherwise a shared-id pair would leak plaintext via iv reuse.
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("produces a payload that is safe inside a <script> body", () => {
    const payload = encryptHtml("</script><script>alert(1)</script>", "pw", IT);
    expect(JSON.stringify(payload)).not.toContain("</script>");
  });
});
