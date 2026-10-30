import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn, nav } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let admin: Page;
let teacher: Page;
let suffixed = "";

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  admin = await (await browser.newContext({ locale: "en-US" })).newPage();
  await logIn(admin, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("addresses in suffix mode", () => {
  it("is switched on by an admin", async () => {
    await nav(admin, "Settings");
    await admin.getByLabel("Teachers' addresses get an ending of their own").check();
    await admin.getByRole("button", { name: "Save" }).first().click();
    await admin.getByText("Saved").waitFor();
    await admin.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Addresses" }).waitFor();

    // A teacher, with a password shown once (no email here).
    await nav(admin, "Users");
    await admin.getByRole("button", { name: "Add user" }).click();
    await admin.getByRole("dialog").getByLabel("Email").fill("tess@example.org");
    await admin.getByRole("dialog").getByRole("button", { name: "Add user" }).click();
    const password = (await admin.getByTestId("secret").textContent()) ?? "";
    await admin.getByRole("button", { name: "Done" }).click();
    teacher = await (await browser.newContext({ locale: "en-US" })).newPage();
    await logIn(teacher, server.origin, "tess@example.org", password);
  }, 60_000);

  it("gives a teacher's new book an ending", async () => {
    await teacher.getByRole("button", { name: "New book" }).click();
    const dialog = teacher.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Physik");
    await dialog.getByText(`physik-····.books.localhost:${server.port}`).waitFor();
    await dialog.getByRole("button", { name: "Create book" }).click();
    await teacher.getByRole("heading", { name: "Physik" }).waitFor();
    suffixed = (await teacher.getByLabel("Address", { exact: true }).inputValue()) ?? "";
    expect(suffixed).toMatch(/^physik-[a-z2-9]{4}$/);
  });

  it("asks for the address without ending", async () => {
    await teacher.getByLabel("Address you would like").fill("physik");
    await teacher.getByLabel("What is the book about?").fill("Physik bis Klasse 10.");
    await teacher.getByRole("button", { name: "Ask for this address" }).click();
    await teacher.getByText("Waiting for an admin").waitFor();
  });

  it("is granted by an admin", async () => {
    await nav(admin, "Addresses");
    const card = admin.getByRole("article", { name: "Request for physik" });
    await card.getByText("Physik bis Klasse 10.").waitFor();
    await card.getByRole("link", { name: `${suffixed}.books.localhost:${server.port}` }).waitFor();
    await card.getByLabel("Note to the teacher (optional)").fill("Gern!");
    await card.getByRole("button", { name: "Grant physik" }).click();
    await admin.getByText("No open requests.").waitFor();
    await admin.getByRole("cell", { name: "physik", exact: true }).waitFor();

    await teacher.reload();
    expect(await teacher.getByLabel("Address", { exact: true }).inputValue()).toBe("physik");
    await teacher.getByText("An admin gave the book this address.").waitFor();
    expect(await teacher.getByLabel("Address", { exact: true }).isDisabled()).toBe(true);
  });

  it("is taken back by an admin", async () => {
    await admin.getByRole("table").getByRole("link", { name: "Physik", exact: true }).click();
    await admin.getByLabel("Note to the owners (optional)").fill("Zurück.");
    await admin.getByRole("button", { name: "Take address back" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Take address back" }).click();
    await admin.getByRole("link", { name: `${suffixed}.books.localhost:${server.port}` }).first().waitFor();

    await teacher.reload();
    expect(await teacher.getByLabel("Address", { exact: true }).inputValue()).toBe(suffixed);
    expect(await teacher.getByLabel("Address", { exact: true }).isDisabled()).toBe(false);
  });
});
