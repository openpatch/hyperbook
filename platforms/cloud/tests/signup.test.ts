import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../src/server/db/schema";
import { client, loggedIn, setup } from "./helpers";

const PASSWORD = "a long enough password";

async function world(mode: "closed" | "open" | "domains" | "approval", domains: string[] = []) {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
  const res = await admin.c.put("/api/instance", {
    signupMode: mode,
    signupDomains: domains,
    privacyMarkdown: "# Privacy\n\nWe keep your email address.",
  });
  expect(res.status).toBe(200);
  instance.mailer.sent.length = 0;
  return { instance, admin };
}

const signup = (c: ReturnType<typeof client>, email: string) =>
  c.post("/api/auth/signup", { email, displayName: "Grace", password: PASSWORD, acceptPrivacy: true });

/** The token of the last link mailed to `to`. */
function mailedToken(instance: ReturnType<typeof setup>, to: string) {
  const mail = instance.mailer.sent.filter((m) => m.to === to).at(-1)!;
  return new URL(/https?:\/\/\S+/.exec(mail.text)![0]).searchParams.get("token")!;
}

describe("sign-up", () => {
  it("opens only with a privacy policy to accept", async () => {
    const instance = setup();
    const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
    expect((await admin.c.put("/api/instance", { signupMode: "open" })).status).toBe(400);
    await admin.c.put("/api/instance", { privacyUrl: "https://example.org/privacy" });
    expect((await admin.c.put("/api/instance", { signupMode: "open" })).status).toBe(200);
  });

  it("shows the instance's own legal pages", async () => {
    const { instance } = await world("open");
    const pub = (await client(instance).get("/api/instance/public")).body;
    expect(pub).toMatchObject({ privacyHref: "/privacy", imprintHref: "" });
    const page = await client(instance).get("/api/instance/public/legal/privacy");
    expect(page.body.html).toContain("<h1>Privacy</h1>");
    expect((await client(instance).get("/api/instance/public/legal/imprint")).status).toBe(404);
  });

  it("is closed by default", async () => {
    const instance = setup();
    const res = await signup(client(instance), "grace@example.org");
    expect(res.status).toBe(403);
    expect((await client(instance).get("/api/instance/public")).body.signupMode).toBe("closed");
  });

  it("makes an account that works once the address is confirmed", async () => {
    const { instance } = await world("open");
    const visitor = client(instance);
    expect((await signup(visitor, "grace@example.org")).body).toEqual({ ok: true, approval: false });

    const login = () => visitor.post("/api/auth/login", { email: "grace@example.org", password: PASSWORD });
    const before = await login();
    expect(before.status).toBe(403);
    expect(before.body.reason).toBe("unverified");

    const verified = await visitor.post("/api/auth/verify", { token: mailedToken(instance, "grace@example.org") });
    expect(verified.body).toEqual({ ok: true, pending: false });
    expect((await login()).status).toBe(200);
    const row = instance.db.select().from(users).where(eq(users.email, "grace@example.org")).get()!;
    expect(row.privacyAcceptedAt).not.toBeNull();
    // A link works once.
    expect((await visitor.post("/api/auth/verify", { token: mailedToken(instance, "grace@example.org") })).status).toBe(400);
  });

  it("needs the privacy policy accepted", async () => {
    const { instance } = await world("open");
    const res = await client(instance).post("/api/auth/signup", {
      email: "grace@example.org",
      displayName: "Grace",
      password: PASSWORD,
      acceptPrivacy: false,
    });
    expect(res.status).toBe(400);
  });

  it("does not reveal existing accounts", async () => {
    const { instance } = await world("open");
    const res = await signup(client(instance), "admin@example.org");
    expect(res.body).toEqual({ ok: true, approval: false });
    expect(instance.mailer.sent.at(-1)!.text).toContain("has an account already");
  });

  it("admits only the listed domains", async () => {
    const { instance } = await world("domains", ["schule.de"]);
    expect((await signup(client(instance), "a@gmail.com")).status).toBe(403);
    expect((await signup(client(instance), "a@schule.de")).status).toBe(200);
    expect((await signup(client(instance), "b@gym.schule.de")).status).toBe(200);
    expect((await signup(client(instance), "c@notschule.de")).status).toBe(403);
  });

  it("waits for an admin in approval mode and tells the admins", async () => {
    const { instance } = await world("approval");
    const visitor = client(instance);
    expect((await signup(visitor, "grace@example.org")).body).toEqual({ ok: true, approval: true });
    const verified = await visitor.post("/api/auth/verify", { token: mailedToken(instance, "grace@example.org") });
    expect(verified.body).toEqual({ ok: true, pending: true });
    expect(instance.mailer.sent.some((m) => m.to === "admin@example.org" && m.subject.includes("waits for approval"))).toBe(true);
    const login = await visitor.post("/api/auth/login", { email: "grace@example.org", password: PASSWORD });
    expect(login.body.reason).toBe("pending");
  });

  it("resends the confirmation, without saying whether the address exists", async () => {
    const { instance } = await world("open");
    await signup(client(instance), "grace@example.org");
    const resend = (email: string) => client(instance).post("/api/auth/verify/resend", { email });
    expect((await resend("grace@example.org")).status).toBe(200);
    expect((await resend("nobody@example.org")).status).toBe(200);
    expect(instance.mailer.sent.filter((m) => m.to === "grace@example.org")).toHaveLength(2);
    expect(instance.mailer.sent.filter((m) => m.to === "nobody@example.org")).toHaveLength(0);
  });

  it("limits sign-ups per address", async () => {
    const { instance } = await world("open");
    for (let i = 0; i < 3; i++) await signup(client(instance), "grace@example.org");
    expect((await signup(client(instance), "grace@example.org")).status).toBe(429);
  });
});
