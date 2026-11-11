import { execFileSync } from "node:child_process";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

/** A real typst for the server: TYPST_BINARY, or one on PATH. */
const typst = (() => {
  if (process.env.TYPST_BINARY) return process.env.TYPST_BINARY;
  try {
    return execFileSync("which", ["typst"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

describe.skipIf(!typst)("the editor's Typst preview", () => {
  beforeAll(async () => {
    server = await startServer({ TYPST_BINARY: typst! });
    browser = await launchBrowser();
    page = await browser.newPage({ locale: "en-US", colorScheme: "light" });
    await logIn(page, server.origin, ADMIN.email, ADMIN.password);
  });

  afterAll(async () => {
    await browser?.close();
    await server?.stop();
  });

  it("draws the open .typ file's PDF on the editor's own light surface, and follows edits", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Typst");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();

    await page.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("Path").fill("book/blatt.typ");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "blatt.typ" }).waitFor();
    await page.locator('.cm-content[aria-label*="blatt.typ"]').click();
    await page.keyboard.type("= Test\n\nDas ist ein super Test.\n");

    // The preview may be open already (the editor remembers it).
    const show = page.getByRole("button", { name: "Show preview" });
    if (await show.isVisible()) await show.click();
    const pane = page.getByRole("region", { name: "Preview" });
    const pageCanvas = pane.getByRole("img", { name: "Page 1" });
    await pageCanvas.waitFor({ timeout: 60_000 });
    // No browser PDF viewer (its toolbar and backdrop are dark), only pages
    // drawn on the editor's surface.
    expect(await pane.locator("iframe").count()).toBe(0);
    const backdrop = await pageCanvas.evaluate((canvas) => getComputedStyle(canvas.parentElement!.parentElement!).backgroundColor);
    const [r, g, b] = backdrop.match(/\d+/g)!.map(Number);
    expect((r! + g! + b!) / 3).toBeGreaterThan(200);

    // An edit draws the new version in place of the old one.
    const before = await pageCanvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.keyboard.type("\n= Zwei\n");
    await expect
      .poll(() => pane.getByRole("img", { name: "Page 1" }).evaluate((c: HTMLCanvasElement) => c.toDataURL()), { timeout: 60_000 })
      .not.toBe(before);

    // A mistake goes to the gutter and the pane keeps the last PDF.
    await page.keyboard.type("#nope()\n");
    await pane.getByText("1 error").waitFor({ timeout: 60_000 });
    await page.locator(".cm-lint-marker-error").first().waitFor();
    expect(await pane.getByRole("img", { name: "Page 1" }).count()).toBe(1);
  }, 180_000);

  it("downloads the PDF, and a double-click on a line finds it in the source", async () => {
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("Path").fill("book/jump.typ");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "jump.typ" }).waitFor();
    await page.locator('.cm-content[aria-label*="jump.typ"]').click();
    // Big text from the top left corner, so the first line is easy to hit.
    // "Hallo" twice, a page each: the second must not find the first.
    await page.keyboard.type(
      "#set page(margin: 0pt, width: 20cm, height: 10cm)\n#set text(size: 40pt)\nHallo Welt Optik\n\n#pagebreak()\nHallo Licht\n",
    );
    const pane = page.getByRole("region", { name: "Preview" });
    const canvas = pane.getByRole("img", { name: "Page 1" });
    await canvas.waitFor({ timeout: 60_000 });
    await expect.poll(() => pane.getByText("Compiling").count(), { timeout: 60_000 }).toBe(0);

    const download = page.waitForEvent("download");
    await pane.getByRole("button", { name: "Download PDF" }).click();
    expect((await download).suggestedFilename()).toBe("jump.pdf");

    // "Hallo" sits at the left of the first line.
    const box = (await canvas.boundingBox())!;
    await page.mouse.dblclick(box.x + box.width * 0.08, box.y + box.height * 0.07);
    // The cursor goes to the line in the open file's editor, its word selected.
    const cursorLine = () => page.locator('.cm-content[aria-label*="jump.typ"] .cm-activeLine').textContent();
    await expect.poll(async () => (await cursorLine())?.trim()).toBe("Hallo Welt Optik");
    await page.locator('.cm-editor:has(.cm-content[aria-label*="jump.typ"]) .cm-selectionBackground').first().waitFor();

    const second = (await pane.getByRole("img", { name: "Page 2" }).boundingBox())!;
    await page.mouse.dblclick(second.x + second.width * 0.08, second.y + second.height * 0.07);
    await expect.poll(async () => (await cursorLine())?.trim()).toBe("Hallo Licht");
  }, 180_000);
});
