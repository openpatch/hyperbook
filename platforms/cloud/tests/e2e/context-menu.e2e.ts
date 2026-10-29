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
  // The menu reads and writes the clipboard, which the browser only allows
  // with these permissions.
  page = await browser.newPage({
    locale: "en-US",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  server?.stop();
});

describe("context menu", () => {
  it("copies, cuts, pastes and selects instead of the browser's menu", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Menu");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();

    const editor = page.locator(".cm-content");
    await editor.getByText("# Menu").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Hello");
    await page.keyboard.press("Enter");
    await page.keyboard.type("world");
    const menu = page.locator(".cm-context-menu");
    const text = () => editor.innerText();
    // The word to right-click and select, exactly one line of its own.
    const hello = editor.getByText("Hello", { exact: true });

    // Without a selection, Cut and Copy are there but disabled.
    await hello.click({ button: "right" });
    await menu.getByRole("button", { name: "Cut" }).waitFor();
    // Styled, so it floats at the click instead of trailing the page.
    expect(await menu.evaluate((box) => getComputedStyle(box).position)).toBe(
      "fixed",
    );
    await expect
      .poll(() => menu.getByRole("button", { name: "Cut" }).isDisabled())
      .toBe(true);
    await expect
      .poll(() => menu.getByRole("button", { name: "Copy" }).isDisabled())
      .toBe(true);
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });

    // A double-click selects a word; the menu copies it.
    await hello.dblclick();
    await hello.click({ button: "right" });
    await menu.getByRole("button", { name: "Copy" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Hello",
    );

    // Select all through the menu, then cut the whole page with it.
    await hello.click({ button: "right" });
    await menu.getByRole("button", { name: "Select all" }).click();
    await hello.click({ button: "right" });
    await menu.getByRole("button", { name: "Cut" }).click();
    await expect.poll(text).not.toContain("Hello world");

    // A paste puts it back at the caret.
    await editor.click({ button: "right" });
    await menu.getByRole("button", { name: "Paste" }).click();
    await expect.poll(text).toContain("Hello");
    await expect.poll(text).toContain("world");
  }, 120_000);

  it("undoes and redoes", async () => {
    const editor = page.locator(".cm-content");
    const menu = page.locator(".cm-context-menu");
    const text = () => editor.innerText();

    await editor.getByText("Hello", { exact: true }).click();
    await page.keyboard.press("End");
    await page.keyboard.type(" and more");
    await editor.getByText("and more").click({ button: "right" });
    await menu.getByRole("button", { name: "Undo" }).click();
    await expect.poll(text).not.toContain("and more");

    await editor.getByText("Hello").click({ button: "right" });
    await menu.getByRole("button", { name: "Redo" }).click();
    await expect.poll(text).toContain("and more");
  }, 120_000);

  it("copies, pastes, renames, moves and deletes in the file tree", async () => {
    const menu = page.locator(".cm-context-menu");
    const tree = page.getByRole("list", { name: "Files" });
    const entry = (name: string) =>
      tree.getByRole("button", { name, exact: true });
    const pick = (label: string) =>
      menu.getByRole("button", { name: label }).click();
    // Unsaved files are not copied; the earlier tests changed the page.
    await page.keyboard.press("Control+s");
    await expect
      .poll(() => tree.locator('[title="Not saved"]').count())
      .toBe(0);

    // Before anything is copied, there is nothing to paste.
    await entry("index.md").click({ button: "right" });
    await expect
      .poll(() => menu.getByRole("button", { name: "Paste" }).isDisabled())
      .toBe(true);
    expect(await menu.evaluate((box) => getComputedStyle(box).position)).toBe(
      "fixed",
    );

    // Files download; only folders get new files, in place of the old
    // "…" menu of every row.
    await menu.getByRole("button", { name: "Download" }).waitFor();
    expect(await menu.getByRole("button", { name: "New file" }).count()).toBe(
      0,
    );
    expect(
      await tree.getByRole("button", { name: /^Actions for/ }).count(),
    ).toBe(0);

    // A copy pasted next to the original gets a copy's name.
    await pick("Copy");
    await entry("book").click({ button: "right" });
    await menu.getByRole("button", { name: "New file" }).waitFor();
    expect(await menu.getByRole("button", { name: "Download" }).count()).toBe(
      0,
    );
    await pick("Paste");
    await entry("index (copy).md").waitFor();

    // Rename asks for the name only, and keeps the file in its folder.
    await entry("index (copy).md").click({ button: "right" });
    await pick("Rename");
    const dialog = page.getByRole("dialog");
    const name = dialog.getByLabel("Name");
    expect(await name.inputValue()).toBe("index (copy).md");
    await name.fill("other/copy.md");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await dialog.getByText("Enter a name without /").waitFor();
    await name.fill("copy.md");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await entry("copy.md").waitFor();
    expect(
      await entry("copy.md").evaluate(
        (button) => (button.parentElement as HTMLElement).style.paddingLeft,
      ),
    ).toBe("16px");

    // Cut, then pasted below the files: moved to the book's root.
    await entry("copy.md").click({ button: "right" });
    await pick("Cut");
    const space = tree.locator("..");
    const box = (await space.boundingBox())!;
    await space.click({
      button: "right",
      position: { x: 20, y: box.height - 8 },
    });
    await pick("Paste");
    await expect
      .poll(() =>
        entry("copy.md").evaluate(
          (button) => (button.parentElement as HTMLElement).style.paddingLeft,
        ),
      )
      .toBe("4px");

    await entry("copy.md").click({ button: "right" });
    await pick("Delete");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await entry("copy.md").waitFor({ state: "detached" });
  }, 120_000);
});
