import { describe, expect, it } from "vitest";
import { ADMIN_HOST, client, createUser, loggedIn, setup } from "./helpers";

describe("login", () => {
  it("logs in, sets a __Host- cookie and knows the user", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org", displayName: "Tea" });
    const c = client(instance);

    expect((await c.get("/api/me")).status).toBe(401);

    const res = await c.post("/api/auth/login", {
      email: " T@Example.org ",
      password: "correct horse battery",
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^__Host-hb_session=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    const me = await c.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: "t@example.org",
      role: "teacher",
      displayName: "Tea",
      entitlements: { private_books: false, max_books: null },
    });
  });

  it("rejects a wrong password and unknown emails alike", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);
    const wrong = await c.post("/api/auth/login", { email: "t@example.org", password: "nope" });
    const unknown = await c.post("/api/auth/login", { email: "x@example.org", password: "nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("blocks an account after 10 failed attempts", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);
    for (let i = 0; i < 10; i++) {
      await c.post("/api/auth/login", { email: "t@example.org", password: "nope" });
    }
    const res = await c.post("/api/auth/login", {
      email: "t@example.org",
      password: "correct horse battery",
    });
    expect(res.status).toBe(429);
  });

  it("refuses disabled accounts", async () => {
    const instance = setup();
    const user = await createUser(instance, { email: "t@example.org" });
    const { users } = await import("../src/server/db/schema");
    const { eq } = await import("drizzle-orm");
    instance.db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, user.id)).run();
    const res = await client(instance).post("/api/auth/login", {
      email: "t@example.org",
      password: "correct horse battery",
    });
    expect(res.status).toBe(401);
  });

  it("logs out", async () => {
    const instance = setup();
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    const cookieBefore = c.cookie;
    expect((await c.post("/api/auth/logout")).status).toBe(200);
    expect((await c.get("/api/me")).status).toBe(401);

    // The old cookie no longer works either.
    const replay = await instance.app.request("/api/me", {
      headers: { host: ADMIN_HOST, cookie: cookieBefore },
    });
    expect(replay.status).toBe(401);
  });
});

describe("request forgery protection", () => {
  it("refuses changing requests from another origin", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const res = await instance.app.request("/api/auth/login", {
      method: "POST",
      headers: {
        host: ADMIN_HOST,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "t@example.org", password: "correct horse battery" }),
    });
    expect(res.status).toBe(403);
  });

  it("refuses form posts, which other sites can send without a preflight", async () => {
    const instance = setup();
    const res = await instance.app.request("/api/auth/login", {
      method: "POST",
      headers: { host: ADMIN_HOST, "content-type": "application/x-www-form-urlencoded" },
      body: "email=t%40example.org&password=x",
    });
    expect(res.status).toBe(415);
  });
});

describe("account", () => {
  it("changes the password and logs out other sessions", async () => {
    const instance = setup();
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    const other = client(instance);
    await other.post("/api/auth/login", {
      email: "t@example.org",
      password: "correct horse battery",
    });

    const wrong = await c.put("/api/me/password", {
      currentPassword: "nope",
      newPassword: "a new long password",
    });
    expect(wrong.status).toBe(400);

    const short = await c.put("/api/me/password", {
      currentPassword: "correct horse battery",
      newPassword: "short",
    });
    expect(short.status).toBe(400);
    expect(short.body.issues[0].path).toBe("newPassword");

    const ok = await c.put("/api/me/password", {
      currentPassword: "correct horse battery",
      newPassword: "a new long password",
    });
    expect(ok.status).toBe(200);
    expect((await c.get("/api/me")).status).toBe(200);
    expect((await other.get("/api/me")).status).toBe(401);

    const again = client(instance);
    expect(
      (await again.post("/api/auth/login", {
        email: "t@example.org",
        password: "a new long password",
      })).status,
    ).toBe(200);
  });

  it("changes the display name", async () => {
    const instance = setup();
    const { c } = await loggedIn(instance, { email: "t@example.org" });
    await c.patch("/api/me", { displayName: "  Ms. T  " });
    expect((await c.get("/api/me")).body.displayName).toBe("Ms. T");
  });
});

describe("password reset by email", () => {
  it("sends a link that sets a new password once", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);

    expect((await c.post("/api/auth/forgot", { email: "t@example.org" })).status).toBe(200);
    expect((await c.post("/api/auth/forgot", { email: "nobody@example.org" })).status).toBe(200);
    expect(instance.mailer.sent).toHaveLength(1);
    const mail = instance.mailer.sent[0]!;
    expect(mail.to).toBe("t@example.org");
    const token = decodeURIComponent(
      mail.text.match(/reset-password\?token=(\S+)/)![1]!,
    );
    expect(mail.text).toContain("http://admin.test/reset-password?token=");

    const reset = await c.post("/api/auth/reset", { token, password: "brand new password" });
    expect(reset.status).toBe(200);
    expect(
      (await c.post("/api/auth/reset", { token, password: "another new password" })).status,
    ).toBe(400);
    expect(
      (await c.post("/api/auth/login", { email: "t@example.org", password: "brand new password" }))
        .status,
    ).toBe(200);
  });
});

describe("password reset limits", () => {
  it("sends at most 3 reset emails per address and hour", async () => {
    const instance = setup();
    await createUser(instance, { email: "t@example.org" });
    const c = client(instance);
    for (let i = 0; i < 5; i++) {
      expect((await c.post("/api/auth/forgot", { email: "t@example.org" })).status).toBe(200);
    }
    expect(instance.mailer.sent).toHaveLength(3);
  });
});

describe("security headers", () => {
  it("sends a content security policy and forbids framing by other sites", async () => {
    const instance = setup();
    const res = await client(instance).get("/api/instance/public");
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("frame-src 'self' http://*.books.test");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});

describe("instance", () => {
  it("shows public settings to anyone", async () => {
    const instance = setup();
    const res = await client(instance).get("/api/instance/public");
    expect(res.body).toMatchObject({ name: "Hyperbook Cloud", booksDomain: "books.test" });
  });

  it("lets only admins change settings", async () => {
    const instance = setup();
    const { c: teacher } = await loggedIn(instance, { email: "t@example.org" });
    const { c: admin } = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    expect((await teacher.put("/api/instance", { name: "School" })).status).toBe(403);
    const res = await admin.put("/api/instance", {
      name: "School",
      defaultEntitlements: { max_books: 3 },
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("School");
    expect((await teacher.get("/api/me")).body.entitlements.max_books).toBe(3);
  });

  it("exposes the landing page switch publicly and lets only admins change it", async () => {
    const instance = setup();
    expect((await client(instance).get("/api/instance/public")).body.landingPage).toBe(true);
    const { c: teacher } = await loggedIn(instance, { email: "t@example.org" });
    const { c: admin } = await loggedIn(instance, { email: "a@example.org", role: "admin" });
    expect((await teacher.put("/api/instance", { landingPage: false })).status).toBe(403);
    expect((await admin.put("/api/instance", { landingPage: false })).status).toBe(200);
    expect((await client(instance).get("/api/instance/public")).body.landingPage).toBe(false);
  });
});
