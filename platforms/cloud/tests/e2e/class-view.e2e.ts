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
let groupId: number;

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

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 20_000): Promise<T> {
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

  const book = await api(admin, "POST", "/api/books", { title: "Waves", slug: "waves" });
  const group = await api(admin, "POST", `/api/books/${book.id}/groups`, { name: "8b" });
  groupId = group.id;
  await api(admin, "POST", `/api/groups/${group.id}/students`, { username: "ada", password: "light-speed" });
  await api(admin, "POST", `/api/groups/${group.id}/students`, { username: "bo", password: "sound-speed" });
  bookUrl = `http://waves.books.localhost:${server.port}`;

  await admin.goto(`${server.origin}/books/${book.id}`);
  const zip = path.join(mkdtempSync(path.join(tmpdir(), "cloud-e2e-zip-")), "waves.zip");
  writeFileSync(
    zip,
    zipSync({
      "hyperbook.json": text(JSON.stringify({ name: "Waves" })),
      "book/index.md": text("---\nname: Waves\n---\n\n# Waves\n\n::textinput{id=\"q1\"}\n\n::textinput{id=\"q2\"}\n"),
    }),
  );
  await admin.getByRole("button", { name: "Manage" }).click();
  await admin.getByRole("menuitem", { name: "Upload a zip" }).click();
  await admin.getByLabel("Upload a zip of your book").setInputFiles(zip);
  await admin.getByText(/^Uploaded 2 files/).waitFor();
  await api(admin, "POST", `/api/books/${book.id}/publish`, {});
  await waitFor(async () => (await api(admin, "GET", `/api/books/${book.id}`)).publishedAt !== null, Boolean, 90_000);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("the class view", () => {
  it("tells students at login that their teacher can see their work", async () => {
    const device = await (await browser.newContext({ locale: "en-US" })).newPage();
    await device.goto(`${bookUrl}/_hyperbook/login`);
    await device.getByText("Your teacher can see it.", { exact: false }).waitFor();
    await device.context().close();
  });

  it("shows which student answered which task, and the answer", async () => {
    const device = await (await browser.newContext({ locale: "en-US" })).newPage();
    await device.goto(`${bookUrl}/_hyperbook/login`);
    await device.getByLabel("Username").fill("ada");
    await device.getByLabel("Password").fill("light-speed");
    await device.getByRole("button", { name: "Log in" }).click();
    await device.getByRole("heading", { name: "Waves" }).waitFor();
    await device.locator('.directive-textinput[data-id="q2"] textarea').fill("A wave carries energy.");
    await waitFor(
      () => device.evaluate(() => fetch("/_hyperbook/api/store").then((r) => r.json())),
      (s: any) => s.rows.some((r: any) => r.table === "textinput" && r.key === "q2" && r.data?.text === "A wave carries energy."),
    );

    await admin.goto(`${server.origin}/groups/${groupId}`);
    await admin.getByRole("tab", { name: "Overview" }).click();
    await admin.getByRole("columnheader", { name: "Waves" }).waitFor();
    // ada is online and worked on task 2; bo has not started.
    const ada = admin.getByRole("row", { name: /ada/ });
    await ada.getByRole("img", { name: "online now" }).waitFor();
    await ada.getByText("1/2").waitFor();
    await admin.getByRole("row", { name: /bo/ }).getByText("0/2").waitFor();

    await ada.getByRole("button", { name: /ada, Waves task 2: changed/ }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByText("ada · Waves, task 2").waitFor();
    await dialog.getByText("A wave carries energy.").waitFor();
    await dialog.getByRole("button", { name: "Done" }).click();

    const csv = await admin.evaluate((id) => fetch(`/api/groups/${id}/overview.csv`).then((r) => r.text()), groupId);
    expect(csv).toContain("Waves 2 (textinput)");
    expect(csv.split("\r\n")[1]).toMatch(/^ada,/);
    await device.context().close();
  }, 90_000);
});
