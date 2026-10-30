import { writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

const text = (s: string) => new TextEncoder().encode(s);

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  page = await browser.newPage();
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("publishing", () => {
  it("uploads a zip, builds it and serves the book on its own host", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Optics");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("heading", { name: "Publishing" }).waitFor();
    await page.getByText("Not published yet.").waitFor();

    // As GitHub's "Download ZIP" packs it: everything inside one top folder.
    const zip = path.join(mkdtempSync(path.join(tmpdir(), "cloud-e2e-zip-")), "optics.zip");
    writeFileSync(
      zip,
      zipSync({
        "optics-main/hyperbook.json": text(JSON.stringify({ name: "Optics", basePath: "/optics" })),
        "optics-main/book/index.md": text("# Light travels\n\nStraight lines, mostly.\n"),
        "optics-main/book/lenses.md": text("# Lenses\n"),
      }),
    );
    await page.getByLabel("Upload a zip of your book").setInputFiles(zip);
    await page.getByText(/Uploaded 3 files/).waitFor();
    await page.getByText("Built", { exact: true }).waitFor({ timeout: 60_000 });
    await page.getByText("Live", { exact: true }).waitFor();
    await page.getByText(/^Published /).waitFor();

    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.getByRole("dialog").getByText(/Ignoring "basePath"/).waitFor();
    await page.keyboard.press("Escape");

    const book = await browser.newPage();
    await book.goto(`http://optics.books.localhost:${server.port}/`);
    await book.getByRole("heading", { name: "Light travels" }).waitFor();
    // Navigation works with clean URLs, and the assets load from the root.
    await book.goto(`http://optics.books.localhost:${server.port}/lenses`);
    await book.getByRole("heading", { name: "Lenses" }).waitFor();
    const styles = await book.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]")].map((l) => l.href),
    );
    expect(styles.some((href) => href.includes("/__hyperbook_assets/"))).toBe(true);
    expect(styles.some((href) => href.includes("/optics/"))).toBe(false);
    await book.close();
  }, 90_000);

  it("shows why an upload was refused", async () => {
    const zip = path.join(mkdtempSync(path.join(tmpdir(), "cloud-e2e-zip-")), "notes.zip");
    writeFileSync(zip, zipSync({ "notes.md": text("# Notes\n") }));
    await page.getByLabel("Upload a zip of your book").setInputFiles(zip);
    await page.getByText("The zip contains no hyperbook.json or hyperlibrary.json").waitFor();
  });
});
