import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, it } from "vitest";
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
  await server?.stop();
});

describe("preview links", () => {
  it("open the page they lead to in the editor", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Links");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();

    await page.getByRole("button", { name: "New file" }).click();
    await dialog.getByLabel("Path").fill("book/next.md");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "next.md" }).waitFor();

    // A relative link on the first page, shown unsaved in the preview.
    await page.getByRole("tab", { name: "index.md" }).click();
    const editor = page.locator(".cm-content");
    await editor.getByText("# Links").click();
    await page.keyboard.press("End");
    await page.keyboard.type("\n\n[Go on](./next)");
    // Close the path completion the link opened.
    await page.keyboard.press("Escape");

    const preview = page.frameLocator('iframe[title="Preview"][aria-hidden="false"]');
    await preview.getByRole("link", { name: "Go on" }).click({ timeout: 60_000 });
    await page.getByRole("tab", { name: "next.md", selected: true }).waitFor();
    await preview.getByRole("heading", { name: "Next" }).waitFor({ timeout: 60_000 });
  }, 120_000);
});
