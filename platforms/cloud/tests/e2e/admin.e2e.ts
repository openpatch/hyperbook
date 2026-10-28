import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn, nav } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;
let teacherPassword = "";

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  page = await browser.newPage();
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  server?.stop();
});

describe("admin", () => {
  it("adds a teacher and shows the password once", async () => {
    await nav(page, "Users");
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill("teacher@example.org");
    await dialog.getByLabel("Name").fill("Ms. Teacher");
    await dialog.getByRole("button", { name: "Add user" }).click();
    teacherPassword = (await page.getByTestId("secret").textContent()) ?? "";
    expect(teacherPassword).toMatch(/^[a-z2-9]{14}$/);
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("link", { name: "teacher@example.org" }).waitFor();
  });

  it("allows private books for that teacher", async () => {
    await page.getByRole("link", { name: "teacher@example.org" }).click();
    await page.getByRole("heading", { name: "Ms. Teacher" }).waitFor();
    await page.getByRole("combobox", { name: "Private books" }).click();
    await page.getByRole("option", { name: "Allowed", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Saved").first().waitFor();
  });

  it("changes instance settings", async () => {
    await nav(page, "Settings");
    await page.getByLabel("Name", { exact: true }).fill("Example School");
    await page.getByLabel("Imprint (legal notice) URL").fill("https://example.org/imprint");
    await page.getByRole("button", { name: "Save" }).first().click();
    await page.getByRole("banner").getByText("Example School").waitFor();
    await page.getByRole("link", { name: "Imprint" }).waitFor();
  });

  it("lets the teacher log in with the generated password", async () => {
    const context = await browser.newContext();
    const teacher = await context.newPage();
    await logIn(teacher, server.origin, "teacher@example.org", teacherPassword);
    await teacher.getByRole("link", { name: "Your account" }).waitFor();
    expect(await teacher.getByRole("link", { name: "Users" }).count()).toBe(0);
    await context.close();
  });

  it("shows the activity log", async () => {
    await nav(page, "Activity");
    await page.getByRole("cell", { name: "added a user" }).first().waitFor();
    await page.getByRole("cell", { name: /changed a user's entitlements/ }).waitFor();
  });
});
