import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

/*
 * Help for teachers new to Markdown and Typst: the formatting toolbar, the
 * "/" menu and the Insert element dialog, and pictures uploaded next to the
 * file they go in.
 */

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  page = await browser.newPage({ locale: "en-US" });
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

/** A one-pixel PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** The text of the shown editor. */
const shown = () => page.locator(".cm-content:visible").textContent();

describe("writing help in the editor", () => {
  it("formats the selection with the toolbar", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Toolbox");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();

    const editor = page.locator(".cm-content:visible");
    await editor.getByText("# Toolbox").click();
    await page.keyboard.press("End");
    await page.keyboard.type("\n\nMake this strong");
    for (let i = 0; i < "strong".length; i++) await page.keyboard.press("Shift+ArrowLeft");

    const toolbar = page.getByRole("toolbar", { name: "Formatting" });
    await toolbar.getByRole("button", { name: "Bold" }).click();
    expect(await shown()).toContain("Make this **strong**");
    // The button names the syntax it writes.
    expect(await toolbar.getByRole("button", { name: "Bold" }).getAttribute("title")).toBe("Bold: **…**");
  }, 120_000);

  it("inserts an element picked from the '/' menu", async () => {
    await page.keyboard.press("End");
    await page.keyboard.type("\n\n/Hint");
    const menu = page.locator(".cm-tooltip-autocomplete");
    await menu.getByText("Hint or solution").waitFor();
    await page.keyboard.press("Enter");
    expect(await shown()).toContain(':::collapsible{title="Hint"}');
    expect(await shown()).not.toContain("/Hint");
  }, 60_000);

  it("starts a drawing from the Insert element dialog, next to the page", async () => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+End");
    await page.getByRole("button", { name: "Element" }).click();
    const dialog = page.getByRole("dialog", { name: "Insert element" });
    await dialog.getByRole("textbox").fill("drawing");
    await dialog.getByRole("button", { name: /^Drawing/ }).click();

    // The drawing opens in its editor; the page points at it.
    await page.getByRole("tab", { name: "drawing.excalidraw" }).waitFor();
    await page.getByRole("tab", { name: "index.md" }).click();
    expect(await shown()).toContain('::excalidraw{src="./drawing.excalidraw"}');
  }, 60_000);

  it("uploads an image next to the page and links it relatively", async () => {
    await page.locator(".cm-content:visible").click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Image" }).click();
    await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });

    await page.getByText("Uploaded photo.png").waitFor();
    expect(await shown()).toContain("![photo](./photo.png)");
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "photo.png", exact: true }).waitFor();
  }, 60_000);

  it("writes Typst's syntax in a Typst file and uploads its images next to it", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    await page.getByLabel("Name of the new file").fill("sheet.typ");
    await page.keyboard.press("Enter");
    await page.getByRole("tab", { name: "sheet.typ" }).waitFor();
    await page.locator('.cm-content[aria-label*="sheet.typ"]').click();
    await page.keyboard.type("Title");

    const toolbar = page.getByRole("toolbar", { name: "Formatting" });
    // Pages only: Typst has no elements.
    expect(await page.getByRole("button", { name: "Element" }).count()).toBe(0);
    await toolbar.getByRole("button", { name: "Heading" }).click();
    expect(await shown()).toContain("= Title");

    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const chooser = page.waitForEvent("filechooser");
    await toolbar.getByRole("button", { name: "Image" }).click();
    await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await page.getByText("Uploaded logo.png").waitFor();
    expect(await shown()).toContain('#image("logo.png")');
  }, 60_000);
});
