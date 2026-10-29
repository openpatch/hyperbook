import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

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
  server?.stop();
});

describe("spell check", () => {
  it("underlines misspelled words", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Spell");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();

    // The start page opens; a sentence with two typos goes at its end.
    const editor = page.locator(".cm-content");
    await editor.getByText("# Spell").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("What an awfull jb.");

    // The underlines need the dictionary, which loads in the background.
    await expect
      .poll(async () => editor.locator(".cm-spell-error").allTextContents(), {
        timeout: 30_000,
      })
      .toEqual(["awfull", "jb"]);
  }, 120_000);

  it("right-clicks a misspelled word into suggestions and the dictionary", async () => {
    const editor = page.locator(".cm-content");
    const menu = page.locator(".cm-context-menu");

    // Right-click the typo: its corrections replace it.
    await editor
      .locator("span.cm-spell-error")
      .filter({ hasText: "awfull" })
      .click({ button: "right" });
    await menu.getByRole("button", { name: "awful", exact: true }).click();
    await editor.getByText("What an awful jb.").waitFor();

    // Right-click the other one: the book's dictionary accepts it.
    await editor
      .locator("span.cm-spell-error")
      .filter({ hasText: "jb" })
      .click({ button: "right" });
    await menu.getByRole("button", { name: /dictionary/ }).click();
    await expect
      .poll(() => editor.locator(".cm-spell-error").count(), {
        timeout: 30_000,
      })
      .toBe(0);
  }, 120_000);
});
