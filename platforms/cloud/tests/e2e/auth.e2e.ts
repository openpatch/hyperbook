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
  page = await browser.newPage();
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("login", () => {
  it("sends visitors to the login page and back after logging in", async () => {
    await page.goto(`${server.origin}/account`);
    await page.waitForURL(/\/login\?next=%2Faccount/);

    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("wrong password");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("alert").getByText("Email or password is wrong").waitFor();

    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(`${server.origin}/account`);
    await page.getByRole("heading", { name: "Your account" }).waitFor();
  });

  it("saves the display name", async () => {
    await page.getByLabel("Name").fill("Head Admin");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Saved").waitFor();
    await page.reload();
    expect(await page.getByLabel("Name").inputValue()).toBe("Head Admin");
    await page.getByRole("banner").getByText("Head Admin").waitFor();
  });

  it("logs out", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login/);
    // The front page is public: it shows the landing with a way to log in.
    await page.goto(`${server.origin}/`);
    await page.getByRole("heading", { name: "Power your Hyperbook" }).waitFor();
    await page.getByRole("link", { name: "Log in" }).waitFor();
    await page.getByRole("link", { name: "Open hyperbook.cloud" }).waitFor();
  });

  it("shows only the login screen when an admin turns the landing page off", async () => {
    await logIn(page, server.origin, ADMIN.email, ADMIN.password);
    await page.goto(`${server.origin}/instance`);
    const general = page.locator("section", { hasText: "General" });
    await general.getByRole("checkbox", { name: /landing page/i }).uncheck();
    await general.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Saved").waitFor();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login/);
    await page.goto(`${server.origin}/`);
    await page.waitForURL(/\/login/);
    await page.getByRole("heading", { name: "Log in" }).waitFor();
  });
});
