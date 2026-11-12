import type { Browser, BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let context: BrowserContext;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  context = await browser.newContext({ locale: "en-US" });
  page = await context.newPage();
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

const tree = () => page.getByRole("list", { name: "Files" });
const entry = (name: string) => tree().getByRole("button", { name, exact: true });
const focused = () => page.evaluate(() => document.activeElement?.textContent ?? "");

/** Turns "Save automatically" in the editor's settings on or off. */
async function autoSave(on: boolean) {
  await page.getByRole("button", { name: "Editor settings" }).click();
  const item = page.getByRole("menuitemcheckbox", { name: "Save automatically" });
  if ((await item.getAttribute("aria-checked")) !== String(on)) await item.click();
  await page.keyboard.press("Escape");
}

async function newFile(name: string) {
  await page.getByRole("button", { name: "New file" }).click();
  await page.getByLabel("Name of the new file").fill(name);
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name }).waitFor();
}

describe("file tree and pages", () => {
  it("is used from the keyboard", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Tree");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();
    await page.getByRole("tab", { name: "index.md" }).waitFor();

    await entry("index.md").focus();
    await page.keyboard.press("ArrowUp");
    await expect.poll(focused).toBe("book");
    // Left folds the folder, Right unfolds it, and Right again goes in.
    await page.keyboard.press("ArrowLeft");
    await entry("index.md").waitFor({ state: "detached" });
    await page.keyboard.press("ArrowRight");
    await entry("index.md").waitFor();
    await page.keyboard.press("ArrowRight");
    await expect.poll(focused).toBe("index.md");
    // F2 renames in place.
    await page.keyboard.press("F2");
    await tree().getByLabel("New name for index.md").waitFor();
    await page.keyboard.press("Escape");
  }, 60_000);

  it("picks several files with Ctrl and Shift and deletes them together", async () => {
    await newFile("a.md");
    await newFile("b.md");
    await newFile("c.md");
    await entry("a.md").click();
    await entry("c.md").click({ modifiers: ["Shift"] });
    await expect.poll(() => tree().locator("[data-selected]").count()).toBe(3);
    // Selected rows stand out from the others, the open one included.
    const shade = (name: string) =>
      entry(name).evaluate((button) => getComputedStyle(button.parentElement!).backgroundColor);
    expect(await shade("b.md")).not.toBe(await shade("index.md"));
    expect(await shade("a.md")).toBe(await shade("b.md"));
    // Ctrl takes one out again.
    await entry("b.md").click({ modifiers: ["Control"] });
    await expect.poll(() => tree().locator("[data-selected]").count()).toBe(2);

    await entry("c.md").click({ button: "right" });
    await page.locator(".cm-context-menu").getByRole("menuitem", { name: "Delete 2 items" }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByText("book/a.md").waitFor();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await entry("a.md").waitFor({ state: "detached" });
    await entry("c.md").waitFor({ state: "detached" });
    await entry("b.md").waitFor();
  }, 60_000);

  it("uploads a pasted picture next to the page and links it", async () => {
    await page.getByRole("tab", { name: "index.md" }).click();
    const editor = page.locator('.cm-content[aria-label*="index.md"]');
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    // A screenshot from the clipboard: a file named image.png, no text.
    await editor.evaluate((content) => {
      const png = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        ),
        (c) => c.charCodeAt(0),
      );
      const data = new DataTransfer();
      data.items.add(new File([png], "image.png", { type: "image/png" }));
      content.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await editor.getByText("![index](./index.png)").waitFor();
    await entry("index.png").waitFor();
  }, 60_000);

  it("brings unsaved text back after the browser tab was closed", async () => {
    const url = page.url();
    // Closing the tab would save otherwise, and leave no draft.
    await autoSave(false);
    const editor = page.locator('.cm-content[aria-label*="index.md"]');
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("Kept in a draft");
    await page.getByTitle("Not saved").first().waitFor();
    // The draft is written a moment after typing stops.
    await page.waitForTimeout(1_500);
    await page.close();

    page = await context.newPage();
    await page.goto(url);
    await page.getByText("Your unsaved changes to book/index.md are back.").waitFor();
    await page.locator('.cm-content[aria-label*="index.md"]').getByText("Kept in a draft").waitFor();
    await page.getByTitle("Not saved").first().waitFor();

    // Leaving the browser tab saves.
    await autoSave(true);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });
    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/index.md`)).text();
    });
    expect(saved).toContain("Kept in a draft");
    expect(saved).toContain("![index](./index.png)");

    // The saves of this session are one entry in the History pane, which
    // unfolds into them.
    await page.getByRole("tab", { name: "History" }).click();
    const pane = page.getByRole("region", { name: "History" });
    const unfold = pane.getByRole("button", { name: /^Show the \d+ saves$/ }).first();
    await unfold.waitFor();
    await unfold.click();
    await expect.poll(() => unfold.getAttribute("aria-expanded")).toBe("true");
  }, 60_000);
});
