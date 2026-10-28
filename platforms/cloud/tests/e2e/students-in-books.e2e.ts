import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let admin: Page;
let bookUrl: string;
let loginUrl: string;
let groupId: number;

const text = (s: string) => new TextEncoder().encode(s);

/** A JSON request from the admin page, as the app would send it. */
function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ([method, url, body]) => {
      const res = await fetch(url as string, {
        method: method as string,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return res.json();
    },
    [method, url, body] as const,
  );
}

/** Rows of the book's local store, as the elements see them. */
function bookmark(page: Page, key: string) {
  return page.evaluate((key) => (window as any).hyperbook.store.db.table("bookmarks").get(key), key);
}

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 15_000): Promise<T> {
  const until = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > until) throw new Error(`Timed out; last value: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  admin = await browser.newPage();
  await logIn(admin, server.origin, ADMIN.email, ADMIN.password);

  const book = await api(admin, "POST", "/api/books", { title: "Optics", slug: "optics" });
  await api(admin, "PATCH", `/api/books/${book.id}`, { visibility: "private" });
  const group = await api(admin, "POST", `/api/books/${book.id}/groups`, { name: "7a" });
  groupId = group.id;
  await api(admin, "POST", `/api/groups/${group.id}/students`, { username: "ada", password: "light-speed" });
  const creds = await api(admin, "GET", `/api/groups/${group.id}/credentials`);
  loginUrl = creds.students[0].loginUrl;
  bookUrl = `http://optics.books.localhost:${server.port}`;

  await admin.goto(`${server.origin}/books/${book.id}`);
  const zip = path.join(mkdtempSync(path.join(tmpdir(), "cloud-e2e-zip-")), "optics.zip");
  writeFileSync(
    zip,
    zipSync({
      "hyperbook.json": text(JSON.stringify({ name: "Optics" })),
      "book/index.md": text("# Light travels\n"),
    }),
  );
  await admin.getByLabel("Upload a zip of your book").setInputFiles(zip);
  await admin.getByText("Built", { exact: true }).waitFor({ timeout: 60_000 });
}, 90_000);

afterAll(async () => {
  await browser?.close();
  server?.stop();
});

describe("students in their book", () => {
  it("asks for a login on a private book and logs in by QR code", async () => {
    const device = await (await browser.newContext({ locale: "en-US" })).newPage();
    await device.goto(`${bookUrl}/`);
    expect(device.url()).toContain("/_hyperbook/login?next=");
    await device.getByLabel("Username").waitFor();

    await device.goto(loginUrl);
    await device.waitForURL(`${bookUrl}/`);
    await device.getByRole("heading", { name: "Light travels" }).waitFor();

    // A change in the book's store is saved to the platform.
    await waitFor(
      () => device.evaluate(() => (window as any).hyperbook.cloud._internal().syncManager !== null),
      Boolean,
    );
    await device.evaluate(() =>
      (window as any).hyperbook.store.db.table("bookmarks").put({ path: "/e2e", label: "From device 1" }),
    );
    const state = await waitFor(
      () => device.evaluate(() => fetch("/_hyperbook/api/store").then((r) => r.json())),
      (s: any) => s.lastEventId >= 1,
    );
    expect(JSON.stringify(state.snapshot)).toContain("From device 1");
    await device.context().close();
  }, 60_000);

  it("brings the work to a second device after a password login", async () => {
    const device = await (await browser.newContext({ locale: "en-US" })).newPage();
    await device.goto(`${bookUrl}/_hyperbook/login`);
    await device.getByLabel("Username").fill("ada");
    await device.getByLabel("Password").fill("light-speed");
    await device.getByRole("button", { name: "Log in" }).click();
    await device.getByRole("heading", { name: "Light travels" }).waitFor();
    const row = await waitFor(() => bookmark(device, "/e2e"), Boolean);
    expect(row).toMatchObject({ label: "From device 1" });
    await device.context().close();
  }, 60_000);

  it("refuses a wrong password on the login page", async () => {
    const device = await (await browser.newContext({ locale: "en-US" })).newPage();
    await device.goto(`${bookUrl}/_hyperbook/login`);
    await device.getByLabel("Username").fill("ada");
    await device.getByLabel("Password").fill("wrong");
    await device.getByRole("button", { name: "Log in" }).click();
    await device.getByText("Username or password is wrong").waitFor();
    await device.context().close();
  });

  it("lets the teacher look at a student's work without changing it", async () => {
    await admin.goto(`${server.origin}/groups/${groupId}`);
    await admin.getByRole("button", { name: "Actions for ada" }).click();
    const [view] = await Promise.all([
      admin.waitForEvent("popup"),
      admin.getByRole("menuitem", { name: "View as student" }).click(),
    ]);
    await view.waitForURL(`${bookUrl}/`);
    await view.locator("#impersonation-banner").getByText("ada").waitFor();
    const row = await waitFor(() => bookmark(view, "/e2e"), Boolean);
    expect(row).toMatchObject({ label: "From device 1" });

    // Nothing is sent from a read-only view.
    const writes: string[] = [];
    view.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/store/")) writes.push(r.url());
    });
    await view.evaluate(() =>
      (window as any).hyperbook.store.db.table("bookmarks").put({ path: "/teacher", label: "Teacher" }),
    );
    await new Promise((r) => setTimeout(r, 3000));
    expect(writes).toEqual([]);
    await view.close();
  }, 60_000);
});
