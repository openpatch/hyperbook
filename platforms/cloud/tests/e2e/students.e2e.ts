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
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
  await page.getByRole("button", { name: "New book" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Physics");
  await page.getByRole("dialog").getByRole("button", { name: "Create book" }).click();
  await page.getByRole("heading", { name: "Physics" }).waitFor();
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("students", () => {
  it("adds a group", async () => {
    await page.getByLabel("New group").fill("7a");
    await page.getByRole("button", { name: "Add group" }).click();
    await page.getByRole("link", { name: /7a\s*0 students/ }).click();
    await page.getByRole("heading", { name: "7a" }).waitFor();
  });

  it("creates accounts and opens the cards", async () => {
    await page.getByRole("button", { name: "Create accounts" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("How many").fill("4");
    await dialog.getByLabel("Username prefix").fill("phy");
    await dialog.getByText("Usernames will be phy01, phy02, …").waitFor();
    await dialog.getByRole("button", { name: "Create accounts" }).click();
    await page.waitForURL(/\/groups\/\d+\/print$/);
    await page.getByText("phy04").waitFor();
    expect(await page.getByRole("img", { name: /^QR code for phy0\d$/ }).count()).toBe(4);
  });

  it("shows the class list with an empty name column", async () => {
    await page.getByRole("button", { name: "Class list for you" }).click();
    await page.getByRole("columnheader", { name: "Name", exact: true }).waitFor();
    const rows = page.getByRole("row");
    expect(await rows.count()).toBe(5);
    const password = (await rows.nth(1).getByRole("cell").nth(2).textContent()) ?? "";
    expect(password).toMatch(/^[a-z2-9]{6}$/);
  });

  it("prints on A4", async () => {
    const pdf = await page.pdf({ format: "A4" });
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("resets a password from the student list", async () => {
    await page.getByRole("link", { name: "← Back" }).click();
    await page.getByRole("button", { name: "Actions for phy02" }).click();
    await page.getByRole("menuitem", { name: "New password" }).click();
    const secret = (await page.getByTestId("secret").textContent()) ?? "";
    expect(secret).toMatch(/^[a-z2-9]{6}$/);
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("link", { name: "Print login cards" }).click();
    await page.getByRole("button", { name: "Class list for you" }).click();
    const row = page.getByRole("row", { name: /phy02/ });
    expect(await row.getByRole("cell").nth(2).textContent()).toBe(secret);
  });

  it("prints the card of one student", async () => {
    await page.getByRole("link", { name: "← Back" }).click();
    await page.getByRole("button", { name: "Actions for phy01" }).click();
    await page.getByRole("menuitem", { name: "Print card" }).click();
    await page.waitForURL(/\/print\?students=\d+$/);
    await page.getByText("Showing 1 of 4 students.").waitFor();
    expect(await page.getByRole("img", { name: /^QR code for phy0\d$/ }).count()).toBe(1);
    await page.getByRole("img", { name: "QR code for phy01" }).waitFor();
    // Switching the layout keeps the choice of students.
    await page.getByRole("button", { name: "Class list for you" }).click();
    expect(await page.getByRole("row").count()).toBe(2);
  });

  it("prints the cards of the selected students", async () => {
    await page.getByRole("link", { name: "← Back" }).click();
    await page.getByRole("checkbox", { name: "Select phy02" }).click();
    await page.getByRole("checkbox", { name: "Select phy03" }).click();
    await page.getByText("2 students selected").waitFor();
    await page.getByRole("link", { name: "Print cards" }).click();
    await page.getByText("Showing 2 of 4 students.").waitFor();
    expect(await page.getByRole("img", { name: /^QR code for phy0\d$/ }).count()).toBe(2);
  });

  it("asks before deleting a student", async () => {
    await page.getByRole("link", { name: "← Back" }).click();
    await page.getByRole("button", { name: "Actions for phy04" }).click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Delete phy04?").waitFor();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("cell", { name: "phy04", exact: true }).waitFor();

    await page.getByRole("button", { name: "Actions for phy04" }).click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete student" }).click();
    await page.getByText("phy04 deleted").waitFor();
    expect(await page.getByRole("cell", { name: "phy04", exact: true }).count()).toBe(0);
  });

  it("moves students to another group", async () => {
    // Moving needs a second group in the book.
    await page.getByRole("link", { name: "Physics" }).click();
    await page.getByLabel("New group").fill("7b");
    await page.getByRole("button", { name: "Add group" }).click();
    await page.getByRole("link", { name: /7a\s*3 students/ }).click();

    await page.getByRole("checkbox", { name: "Select phy02" }).click();
    await page.getByRole("checkbox", { name: "Select phy03" }).click();
    await page.getByRole("button", { name: "Move…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Move 2 students").waitFor();
    await dialog.getByLabel("To group").click();
    await page.getByRole("option", { name: "7b" }).click();
    await dialog.getByRole("button", { name: "Move", exact: true }).click();
    await page.getByText("2 students moved to 7b").waitFor();
    expect(await page.getByRole("cell", { name: "phy02", exact: true }).count()).toBe(0);
    await page.getByRole("cell", { name: "phy01", exact: true }).waitFor();

    await page.getByRole("link", { name: "Physics" }).click();
    await page.getByRole("link", { name: /7b\s*2 students/ }).click();
    await page.getByRole("cell", { name: "phy03", exact: true }).waitFor();
  });
});
