import { describe, expect, it } from "vitest";
import { client, loggedIn, setup } from "./helpers";

async function adminAndTeacher() {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
  const teacher = await loggedIn(instance, { email: "t@example.org" });
  return { instance, admin, teacher };
}

describe("user management", () => {
  it("is for admins only", async () => {
    const { teacher } = await adminAndTeacher();
    expect((await teacher.c.get("/api/users")).status).toBe(403);
    expect((await teacher.c.post("/api/users", { email: "x@example.org" })).status).toBe(403);
  });

  it("creates a teacher with a generated password shown once, without email", async () => {
    const { instance, admin } = await adminAndTeacher();
    instance.mailer.enabled = false;
    const res = await admin.c.post("/api/users", {
      email: "New@Example.org",
      displayName: "New Teacher",
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "new@example.org", role: "teacher" });
    expect(res.body.password).toMatch(/^[a-z2-9]{14}$/);

    const other = client(instance);
    const login = await other.post("/api/auth/login", {
      email: "new@example.org",
      password: res.body.password,
    });
    expect(login.status).toBe(200);

    expect((await admin.c.get(`/api/users/${res.body.user.id}`)).body).not.toHaveProperty(
      "password",
    );
    expect((await admin.c.post("/api/users", { email: "new@example.org" })).status).toBe(409);
  });

  it("invites a teacher to choose a password, with email", async () => {
    const { instance, admin } = await adminAndTeacher();
    const res = await admin.c.post("/api/users", { email: "new@example.org", displayName: "New" });
    expect(res.body).toMatchObject({ password: null, invited: true, user: { unverified: true, pending: false } });
    const mail = instance.mailer.sent.at(-1)!;
    expect(mail.to).toBe("new@example.org");
    const token = new URL(/https?:\/\/\S+/.exec(mail.text)![0]).searchParams.get("token")!;

    // Again, while it is not taken up yet.
    expect((await admin.c.post(`/api/users/${res.body.user.id}/invite`)).status).toBe(200);

    const other = client(instance);
    expect((await other.post("/api/auth/reset", { token, password: "my own password" })).status).toBe(200);
    expect((await other.post("/api/auth/login", { email: "new@example.org", password: "my own password" })).status).toBe(200);
    expect((await admin.c.get(`/api/users/${res.body.user.id}`)).body.unverified).toBe(false);
    expect((await admin.c.post(`/api/users/${res.body.user.id}/invite`)).status).toBe(409);
  });

  it("approves sign-ups waiting for an admin", async () => {
    const { instance, admin } = await adminAndTeacher();
    await admin.c.put("/api/instance", { signupMode: "approval", privacyUrl: "https://example.org/privacy" });
    const visitor = client(instance);
    await visitor.post("/api/auth/signup", {
      email: "grace@example.org",
      displayName: "Grace",
      password: "a long enough password",
      acceptPrivacy: true,
    });
    const waiting = (await admin.c.get("/api/users")).body.find((u: { email: string }) => u.email === "grace@example.org");
    expect(waiting).toMatchObject({ pending: true, unverified: true });
    expect((await admin.c.post(`/api/users/${waiting.id}/approve`)).body.pending).toBe(false);
    expect(instance.mailer.sent.at(-1)).toMatchObject({ to: "grace@example.org" });
    expect((await admin.c.post(`/api/users/${waiting.id}/approve`)).status).toBe(409);
  });

  it("lists users", async () => {
    const { admin } = await adminAndTeacher();
    const res = await admin.c.get("/api/users");
    expect(res.body.map((u: { email: string }) => u.email)).toEqual([
      "a@example.org",
      "t@example.org",
    ]);
  });

  it("disables an account and ends its sessions", async () => {
    const { admin, teacher } = await adminAndTeacher();
    const res = await admin.c.patch(`/api/users/${teacher.user.id}`, { disabled: true });
    expect(res.body.disabled).toBe(true);
    expect((await teacher.c.get("/api/me")).status).toBe(401);
    await admin.c.patch(`/api/users/${teacher.user.id}`, { disabled: false });
    expect((await admin.c.get(`/api/users/${teacher.user.id}`)).body.disabled).toBe(false);
  });

  it("protects admins from locking themselves out", async () => {
    const { admin } = await adminAndTeacher();
    const id = admin.user.id;
    expect((await admin.c.patch(`/api/users/${id}`, { disabled: true })).status).toBe(400);
    expect((await admin.c.patch(`/api/users/${id}`, { role: "teacher" })).status).toBe(400);
    expect((await admin.c.delete(`/api/users/${id}`)).status).toBe(400);
  });

  it("sets a new password and logs the user out", async () => {
    const { instance, admin, teacher } = await adminAndTeacher();
    const res = await admin.c.put(`/api/users/${teacher.user.id}/password`, {});
    expect(res.body.password).toMatch(/^[a-z2-9]{14}$/);
    expect((await teacher.c.get("/api/me")).status).toBe(401);
    expect(
      (await client(instance).post("/api/auth/login", {
        email: "t@example.org",
        password: res.body.password,
      })).status,
    ).toBe(200);
  });

  it("deletes a user", async () => {
    const { admin, teacher } = await adminAndTeacher();
    expect((await admin.c.delete(`/api/users/${teacher.user.id}`)).status).toBe(200);
    expect((await admin.c.get(`/api/users/${teacher.user.id}`)).status).toBe(404);
  });

  it("stores where each element's runtime loads from", async () => {
    const { teacher } = await adminAndTeacher();
    expect((await teacher.c.get("/api/instance")).status).toBe(403);

    const { admin } = await adminAndTeacher();
    // Unknown elements are rejected.
    const bad = await admin.c.put("/api/instance", { elementRuntimes: { pyide: "cdn", nosuch: "cdn" } });
    expect(bad.status).toBe(400);

    const saved = await admin.c.put("/api/instance", { elementRuntimes: { pyide: "cdn", typst: "local" } });
    expect(saved.status).toBe(200);
    expect(saved.body.elementRuntimes).toEqual({ pyide: "cdn", typst: "local" });
    expect((await admin.c.get("/api/instance")).body.elementRuntimes).toEqual({
      pyide: "cdn",
      typst: "local",
    });
  });
});

describe("entitlements", () => {
  it("combines built-in defaults, instance defaults and overrides", async () => {
    const { admin, teacher } = await adminAndTeacher();
    const url = `/api/users/${teacher.user.id}`;

    expect((await admin.c.get(url)).body.entitlements).toEqual({
      private_books: false,
      max_books: null,
      max_storage_mb: null,
      custom_domain: false,
      ai: true,
      ai_requests_per_day: null,
    });

    await admin.c.put("/api/instance", { defaultEntitlements: { max_books: 5 } });
    expect((await admin.c.get(url)).body.entitlements.max_books).toBe(5);

    const res = await admin.c.put(`${url}/entitlements`, { private_books: true, max_books: null });
    expect(res.body.entitlementOverrides).toEqual({ private_books: true, max_books: null });
    expect(res.body.entitlements).toMatchObject({ private_books: true, max_books: null });
    expect((await teacher.c.get("/api/me")).body.entitlements.private_books).toBe(true);

    // Removing the override falls back to the instance default again.
    await admin.c.put(`${url}/entitlements`, {});
    expect((await admin.c.get(url)).body.entitlements).toMatchObject({
      private_books: false,
      max_books: 5,
    });
  });

  it("does not limit admins", async () => {
    const { admin } = await adminAndTeacher();
    await admin.c.put("/api/instance", { defaultEntitlements: { max_books: 0 } });
    expect((await admin.c.get("/api/me")).body.entitlements).toMatchObject({
      private_books: true,
      max_books: null,
    });
  });
});
