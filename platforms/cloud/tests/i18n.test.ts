import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { errorResponse, httpError } from "../src/server/errors";
import { users } from "../src/server/db/schema";
import {
  catalogs,
  createT,
  flattenKeys,
  interpolate,
  isMessageKey,
  parseAcceptLanguage,
  type MessageKey,
} from "../src/shared/i18n";
import { client, createUser, loggedIn, setup } from "./helpers";

describe("the catalogs", () => {
  it("have the same keys in every language", () => {
    expect(flattenKeys(catalogs.de).sort()).toEqual(flattenKeys(catalogs.en).sort());
  });

  it("interpolate {{params}} and leave unknown ones alone", () => {
    expect(interpolate("Hello {{name}}!", { name: "Tea" })).toBe("Hello Tea!");
    expect(interpolate("Hello {{name}}!", {})).toBe("Hello {{name}}!");
    expect(interpolate("plain")).toBe("plain");
  });

  it("translates, falls back to English, then to the key itself", () => {
    expect(createT("de")("mail.reset.subject")).toBe("Passwort zurücksetzen");
    expect(createT("en")("mail.reset.subject")).toBe("Reset your password");
    expect(createT("de")("mail.verify.subject", { name: "Schule" })).toContain("Schule");
    expect(createT("de")("no.such.key" as MessageKey)).toBe("no.such.key");
  });

  it("knows which strings are catalog keys (validation messages)", () => {
    expect(isMessageKey("validation.email")).toBe(true);
    expect(isMessageKey("Enter a valid email address")).toBe(false);
  });
});

describe("the server's error messages", () => {
  // Errors reach teachers and students, so they are catalog keys, translated
  // when they are sent (src/server/errors.ts), never English text.
  it("are catalog keys", () => {
    const dir = path.join(import.meta.dirname, "../src/server");
    const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".ts"));
    const offending: string[] = [];
    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      for (const match of source.matchAll(/HTTPException\(\d+, \{\s*message:\s*(["`])([^"`]*)\1/g)) {
        if (match[1] === "`" || !isMessageKey(match[2]!)) offending.push(`${file}: ${match[2]}`);
      }
      for (const match of source.matchAll(/httpError\(\d+, "([^"]*)"/g)) {
        if (!isMessageKey(match[1]!)) offending.push(`${file}: ${match[1]}`);
      }
    }
    expect(offending).toEqual([]);
  });
});

describe("parseAcceptLanguage", () => {
  it("picks the best supported language by quality value", () => {
    expect(parseAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(parseAcceptLanguage("de;q=0.5,en;q=0.9")).toBe("en");
    expect(parseAcceptLanguage("de-AT")).toBe("de");
    expect(parseAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.1")).toBe("en");
  });

  it("returns null when nothing supported is listed", () => {
    expect(parseAcceptLanguage("fr-FR,fr;q=0.9")).toBeNull();
    expect(parseAcceptLanguage("*")).toBeNull();
    expect(parseAcceptLanguage(undefined)).toBeNull();
    expect(parseAcceptLanguage("")).toBeNull();
  });
});

describe("the request locale", () => {
  it("answers login errors in the browser's language", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);
    const body = { email: "t@example.org", password: "wrong password" };

    const en = await c.raw("POST", "/api/auth/login", body, { "accept-language": "en-US" });
    expect(en.status).toBe(401);
    expect(en.body.error).toBe("Email or password is wrong");

    const de = await c.raw("POST", "/api/auth/login", body, { "accept-language": "de-DE,de;q=0.9" });
    expect(de.status).toBe(401);
    expect(de.body.error).toBe("E-Mail oder Passwort ist falsch");
  });

  it("translates validation issues into the request's language", async () => {
    const instance = setup();
    const c = client(instance);
    const res = await c.raw("POST", "/api/auth/login", { email: "nope", password: "" }, { "accept-language": "de" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Ungültige Eingabe");
    const messages = res.body.issues.map((i: { message: string }) => i.message);
    expect(messages).toContain("Geben Sie eine gültige E-Mail-Adresse ein");
    expect(messages).toContain("Geben Sie Ihr Passwort ein");
  });

  it("prefers the user's choice, then the instance default, over Accept-Language", async () => {
    const instance = setup();
    const { c: admin } = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    // The instance default is German; an English browser still gets German.
    expect((await admin.put("/api/instance", { defaultLocale: "de" })).status).toBe(200);
    expect((await client(instance).get("/api/instance/public")).body.defaultLocale).toBe("de");
    const anon = client(instance);
    const res = await anon.raw(
      "POST",
      "/api/auth/login",
      { email: "x@example.org", password: "wrong password" },
      { "accept-language": "en" },
    );
    expect(res.body.error).toBe("E-Mail oder Passwort ist falsch");

    // The user's own choice beats the instance default.
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    expect((await c.patch("/api/me", { locale: "en" })).status).toBe(200);
    expect((await c.get("/api/me")).body.locale).toBe("en");
    const own = await c.raw(
      "POST",
      "/api/auth/login",
      { email: "t@example.org", password: "wrong password" },
      { "accept-language": "de-DE" },
    );
    expect(own.body.error).toBe("Email or password is wrong");

    // Clearing the choice follows the instance default again.
    expect((await c.patch("/api/me", { locale: null })).status).toBe(200);
    expect((await c.get("/api/me")).body.locale).toBeNull();
    const cleared = await c.raw("POST", "/api/auth/login", { email: "t@example.org", password: "wrong password" });
    expect(cleared.body.error).toBe("E-Mail oder Passwort ist falsch");
  });

  it("answers teachers' errors in their language", async () => {
    const instance = setup();
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    expect((await c.patch("/api/me", { locale: "de" })).status).toBe(200);
    const book = (await c.post("/api/books", { title: "Physik", slug: "physik" })).body;
    expect((await c.post(`/api/books/${book.id}/groups`, { name: "7a" })).status).toBe(200);
    const again = await c.post(`/api/books/${book.id}/groups`, { name: "7a" });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("Dieses Buch hat schon eine Gruppe mit diesem Namen");
    const empty = await c.post(`/api/books/${book.id}/groups`, { name: " " });
    expect(empty.body.issues[0].message).toBe("Geben Sie einen Namen ein");
  });

  it("fills the params of a translated error", async () => {
    const app = new Hono();
    app.onError((error, c) => errorResponse(c, error as HTTPException));
    app.get("/", () => {
      throw httpError(404, "errors.publishing.noVersion", { tag: "v3" });
    });
    const res = await app.request("/", { headers: { "accept-language": "de" } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Dieses Buch hat keine Version v3" });
  });

  it("rejects a locale the platform does not speak", async () => {
    const instance = setup();
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    expect((await c.patch("/api/me", { locale: "fr" })).status).toBe(400);
  });
});

describe("emails", () => {
  it("goes to the user in their own language", async () => {
    const instance = setup();
    const user = await createUser(instance, { email: "t@example.org" });
    instance.db.update(users).set({ locale: "de" }).where(eq(users.id, user.id)).run();

    const c = client(instance);
    expect((await c.post("/api/auth/forgot", { email: "t@example.org" })).status).toBe(200);
    const mail = instance.mailer.sent[0]!;
    expect(mail.to).toBe("t@example.org");
    expect(mail.subject).toBe("Passwort zurücksetzen");
    expect(mail.text).toContain("innerhalb einer Stunde");
    expect(mail.text).toContain("http://admin.test/reset-password?token=");
  });

  it("follows the instance default when the user has no choice", async () => {
    const instance = setup();
    const { c: admin } = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    await admin.put("/api/instance", { defaultLocale: "de" });
    await createUser(instance, { email: "t@example.org" });

    const c = client(instance);
    await c.post("/api/auth/forgot", { email: "t@example.org" });
    expect(instance.mailer.sent[0]!.subject).toBe("Passwort zurücksetzen");
  });

  it("stays English by default", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);
    await c.post("/api/auth/forgot", { email: "t@example.org" });
    expect(instance.mailer.sent[0]!.subject).toBe("Reset your password");
  });
});
