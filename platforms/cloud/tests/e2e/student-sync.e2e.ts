import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

/*
 * A student's work follows them from page to page and device to device, and
 * the book never asks "leave page?": a change not uploaded yet stays marked
 * on the device and the next page uploads it.
 */

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let admin: Page;
let bookUrl: string;

const text = (s: string) => new TextEncoder().encode(s);

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

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 15_000): Promise<T> {
  const until = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > until) throw new Error(`Timed out; last value: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const PAGE_ONE = `# Page one

[To page two](/two)

:::collapsible{title="Hint"}
Look closely.
:::

::::tabs
:::tab{title="A"}
Alpha
:::
:::tab{title="B"}
Beta
:::
::::

:textinput{placeholder="Your answer"}
`;

const PAGE_TWO = `# Page two

[Back to page one](/)

:::collapsible{title="Second hint"}
Even closer.
:::
`;

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  admin = await browser.newPage();
  await logIn(admin, server.origin, ADMIN.email, ADMIN.password);

  const book = await api(admin, "POST", "/api/books", { title: "Waves", slug: "waves" });
  const group = await api(admin, "POST", `/api/books/${book.id}/groups`, { name: "8b" });
  await api(admin, "POST", `/api/groups/${group.id}/students`, { username: "lin", password: "sound-speed" });
  bookUrl = `http://waves.books.localhost:${server.port}`;

  await admin.goto(`${server.origin}/books/${book.id}`);
  const zip = path.join(mkdtempSync(path.join(tmpdir(), "cloud-e2e-zip-")), "waves.zip");
  writeFileSync(
    zip,
    zipSync({
      "hyperbook.json": text(JSON.stringify({ name: "Waves" })),
      "book/index.md": text(PAGE_ONE),
      "book/two.md": text(PAGE_TWO),
    }),
  );
  await admin.getByRole("button", { name: "Manage" }).click();
  await admin.getByRole("menuitem", { name: "Upload a zip" }).click();
  await admin.getByLabel("Upload a zip of your book").setInputFiles(zip);
  await admin.getByText(/^Uploaded 3 files/).waitFor();
  await api(admin, "POST", `/api/books/${book.id}/publish`, {});
  await waitFor(
    async () => (await api(admin, "GET", `/api/books/${book.id}`)).publishedAt !== null,
    Boolean,
  );
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

/** A fresh device; any dialog it shows is recorded and dismissed. */
async function newDevice() {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(`${d.type()} on ${page.url()}`);
    d.dismiss().catch(() => {});
  });
  return { page, dialogs };
}

async function logInAs(page: Page, username: string, password: string) {
  await page.goto(`${bookUrl}/_hyperbook/login`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("heading", { name: "Page one" }).waitFor();
  await syncReady(page);
}

/**
 * Waits until the page has finished its start-up sync and tracks changes. The
 * first sync on a device reloads the page once, which this rides through.
 */
async function syncReady(page: Page) {
  await waitFor(
    () =>
      page
        .evaluate(async () => {
          const cloud = (window as any).hyperbook.cloud;
          await cloud._internal().ready;
          const { tracking, reloading } = cloud._internal();
          return tracking && !reloading;
        })
        .catch(() => false),
    Boolean,
  );
}

function saved(page: Page) {
  return page.evaluate(() => fetch("/_hyperbook/api/store").then((r) => r.json()));
}

describe("student sync across pages", () => {
  it("follows a link right after a change without asking, and keeps the change", async () => {
    const { page, dialogs } = await newDevice();
    await logInAs(page, "lin", "sound-speed");

    // Switch a tab (a store write), then follow a link straight away.
    await page.getByText("B", { exact: true }).first().click();
    await page.getByRole("link", { name: "To page two" }).click();
    await page.getByRole("heading", { name: "Page two" }).waitFor();
    await syncReady(page);
    expect(dialogs).toEqual([]);

    // The next page uploaded what the last one had not.
    const state = await waitFor(
      () => saved(page),
      (s: any) => s.rows.some((r: any) => r.table === "tabs"),
    );
    expect(state.rows.find((r: any) => r.table === "tabs").data.active).toBeTruthy();

    // Type an answer, then leave as soon as the field has written it.
    await page.getByRole("link", { name: "Back to page one" }).click();
    await page.getByRole("heading", { name: "Page one" }).waitFor();
    await syncReady(page);
    await page.getByPlaceholder("Your answer").fill("A wave carries energy.");
    await page.waitForTimeout(700);
    await page.getByRole("link", { name: "To page two" }).click();
    await page.getByRole("heading", { name: "Page two" }).waitFor();
    await syncReady(page);
    expect(dialogs).toEqual([]);
    await waitFor(
      () => saved(page),
      (s: any) => s.rows.some((r: any) => r.table === "textinput" && r.data.text === "A wave carries energy."),
    );
    await page.context().close();
  }, 60_000);

  it("compresses a large upload, and the server unpacks it", async () => {
    const { page } = await newDevice();
    await logInAs(page, "lin", "sound-speed");
    const encodings: Array<string | null> = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/_hyperbook/api/store")) {
        encodings.push(r.headers()["content-encoding"] ?? null);
      }
    });
    const essay = "Sound is a longitudinal wave. ".repeat(2000);
    await page.evaluate(
      (text) => (window as any).hyperbook.store.db.table("textinput").put({ id: "essay", text }),
      essay,
    );
    await waitFor(
      () => saved(page),
      (s: any) => s.rows.some((r: any) => r.table === "textinput" && r.key === "essay" && r.data.text === essay),
    );
    expect(encodings).toContain("gzip");
    await page.context().close();
  }, 60_000);

  it("brings the work to a second device", async () => {
    const { page, dialogs } = await newDevice();
    await logInAs(page, "lin", "sound-speed");
    await waitFor(() => page.getByPlaceholder("Your answer").inputValue(), (v) => v === "A wave carries energy.");
    expect(dialogs).toEqual([]);
    await page.context().close();
  }, 60_000);
});
