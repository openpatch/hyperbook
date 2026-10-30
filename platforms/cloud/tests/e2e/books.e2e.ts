import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn, nav } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

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

describe("books", () => {
  it("creates a book with an address suggested from its title", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Physik 7ä");
    expect(await dialog.getByLabel("Address").inputValue()).toBe("physik-7ae");
    await dialog.getByText(`physik-7ae.books.localhost:${server.port}`).waitFor();
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("heading", { name: "Physik 7ä" }).waitFor();
    await page.getByRole("link", { name: `physik-7ae.books.localhost:${server.port}` }).waitFor();
  });

  it("explains a taken address", async () => {
    await nav(page, "Books");
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Physik 7ä");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await dialog.getByText("Another book uses this address already").waitFor();
    await page.keyboard.press("Escape");
  });

  it("changes the address and visibility", async () => {
    await page.getByRole("link", { name: /Physik 7ä/ }).click();
    await page.getByLabel("Address").fill("physik-8a");
    await page.getByRole("combobox", { name: "Visibility" }).click();
    await page.getByRole("option", { name: /Private/ }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Saved").waitFor();
    await page.getByRole("link", { name: `physik-8a.books.localhost:${server.port}` }).waitFor();
    await page.getByText("Private", { exact: true }).first().waitFor();
  });

  it("adds a teacher as editor", async () => {
    // A second account to share the book with.
    await nav(page, "Users");
    await page.getByRole("button", { name: "Add user" }).click();
    await page.getByRole("dialog").getByLabel("Email").fill("colleague@example.org");
    await page.getByRole("dialog").getByRole("button", { name: "Add user" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await nav(page, "Books");
    await page.getByRole("link", { name: /Physik 7ä/ }).click();
    await page.getByLabel("Add a teacher by email").fill("colleague@example.org");
    await page.getByRole("button", { name: "Add as editor" }).click();
    await page.getByRole("cell", { name: "colleague@example.org" }).waitFor();
  });

  it("sets a custom domain and shows the DNS record it needs", async () => {
    await page.getByLabel("Domain").fill("Buch.Schule.test");
    await page.getByRole("button", { name: "Set domain" }).click();
    await page.getByText("Waiting for DNS").waitFor();
    await page.getByRole("cell", { name: "buch.schule.test", exact: true }).waitFor();
    await page.getByRole("cell", { name: `physik-8a.books.localhost`, exact: true }).waitFor();

    await page.getByRole("button", { name: "Remove domain" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove domain" }).click();
    await page.getByRole("button", { name: "Set domain" }).waitFor();
    expect(await page.getByText("Waiting for DNS").count()).toBe(0);
  });

  it("deletes the book", async () => {
    await page.getByRole("button", { name: "Delete book" }).click();
    const confirm = page.getByRole("dialog").getByRole("button", { name: "Delete book" });
    expect(await confirm.isDisabled()).toBe(true);
    await page.getByRole("dialog").getByLabel(/Type .* to confirm/).fill("Physik 7ä");
    await confirm.click();
    await page.waitForURL(`${server.origin}/books`);
    await page.getByText("No books yet").waitFor();
  });
});
