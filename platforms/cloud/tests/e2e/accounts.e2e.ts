import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn, nav } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let admin: Page;
const outbox = mkdtempSync(path.join(tmpdir(), "cloud-e2e-mail-"));

/** The link in the newest email to `to`. */
function mailedLink(to: string): string {
  const mails = readdirSync(outbox)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(outbox, f), "utf8")) as { to: string; text: string })
    .filter((m) => m.to === to);
  return /https?:\/\/\S+/.exec(mails.at(-1)!.text)![0];
}

async function visitor() {
  return (await browser.newContext({ locale: "en-US" })).newPage();
}

beforeAll(async () => {
  server = await startServer({ MAIL_OUTBOX_DIR: outbox });
  browser = await launchBrowser();
  admin = await (await browser.newContext({ locale: "en-US" })).newPage();
  await logIn(admin, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("accounts", () => {
  it("invites a teacher who chooses their own password", async () => {
    await nav(admin, "Users");
    await admin.getByRole("button", { name: "Add user" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Email").fill("ada@example.org");
    await dialog.getByLabel("Name").fill("Ada");
    await dialog.getByRole("button", { name: "Add user" }).click();
    await admin.getByText("An invitation went to ada@example.org.").waitFor();
    await admin.getByText("Email not confirmed").waitFor();

    const ada = await visitor();
    await ada.goto(mailedLink("ada@example.org"));
    await ada.getByRole("heading", { name: "Choose your password" }).waitFor();
    await ada.getByLabel("New password", { exact: true }).fill("ada's own password");
    await ada.getByLabel("Repeat the new password").fill("ada's own password");
    await ada.getByRole("button", { name: "Set password" }).click();
    await ada.getByRole("heading", { name: "Your account is ready" }).waitFor();
    await logIn(ada, server.origin, "ada@example.org", "ada's own password");
  }, 60_000);

  it("signs teachers up after confirming their address and an admin's approval", async () => {
    await nav(admin, "Settings");
    // Sign-up asks to accept the privacy policy, so it comes first.
    await admin.getByLabel("Privacy policy text (Markdown)").fill("# Privacy\n\nWe keep your **email address**.");
    await admin.getByRole("button", { name: "Save" }).first().click();
    await admin.getByText("Saved").first().waitFor();
    await admin.getByLabel("Who may sign up").click();
    await admin.getByRole("option", { name: "With approval" }).click();
    await admin.getByRole("button", { name: "Save" }).nth(1).click();
    await admin.getByText("Saved").first().waitFor();

    const grace = await visitor();
    await grace.goto(`${server.origin}/login`);
    await grace.getByRole("link", { name: "No account yet? Sign up" }).click();
    await grace.getByLabel("Your name").fill("Grace");
    await grace.getByLabel("Email").fill("grace@example.org");
    await grace.getByLabel("Password", { exact: true }).fill("grace's password");
    await grace.getByLabel("Repeat the password").fill("grace's password");
    await grace.getByRole("button", { name: "Sign up" }).click();
    // The privacy policy has to be accepted.
    await grace.getByText("Accept the privacy policy to sign up").waitFor();
    await grace.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).waitFor();
    await grace.getByLabel("I accept the privacy policy.").check();
    await grace.getByRole("button", { name: "Sign up" }).click();
    await grace.getByRole("heading", { name: "Check your email" }).waitFor();

    // Logging in before confirming says what is missing and resends the link.
    await grace.goto(`${server.origin}/login`);
    await grace.getByLabel("Email").fill("grace@example.org");
    await grace.getByLabel("Password").fill("grace's password");
    await grace.getByRole("button", { name: "Log in" }).click();
    await grace.getByText(/Confirm your email address first/).waitFor();
    await grace.getByRole("button", { name: "Send the link again" }).click();
    await grace.getByRole("button", { name: "Sent. Check your email." }).waitFor();

    await grace.goto(mailedLink("grace@example.org"));
    await grace.getByRole("heading", { name: "Address confirmed" }).waitFor();
    await grace.getByText(/An admin approves your account next/).waitFor();

    await nav(admin, "Users");
    await admin.getByText("Waits for approval").waitFor();
    await admin.getByRole("button", { name: "Approve" }).click();
    await admin.getByText("grace@example.org is approved.").waitFor();
    expect(mailedLink("grace@example.org")).toContain("/login");

    await logIn(grace, server.origin, "grace@example.org", "grace's password");
  }, 60_000);

  it("shows the privacy policy written in the settings", async () => {
    const page = await visitor();
    await page.goto(`${server.origin}/privacy`);
    await page.getByRole("heading", { name: "Privacy", exact: true }).first().waitFor();
    await page.getByText("email address").waitFor();
    expect(await page.locator("strong").filter({ hasText: "email address" }).count()).toBe(1);
  });

  it("shows a teacher's storage and refuses saves over the limit", async () => {
    // Ada (invited above) may store 1 MB.
    await nav(admin, "Users");
    await admin.getByRole("link", { name: "ada@example.org" }).click();
    const users = await admin.evaluate(async () => (await fetch("/api/users")).json());
    const ada = users.find((u: { email: string }) => u.email === "ada@example.org");
    await admin.evaluate(async (id) => {
      await fetch(`/api/users/${id}/entitlements`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_storage_mb: 1 }),
      });
    }, ada.id);

    const page = await visitor();
    await logIn(page, server.origin, "ada@example.org", "ada's own password");
    await page.getByRole("button", { name: "New book" }).click();
    await page.getByRole("dialog").getByLabel("Title").fill("Sound");
    await page.getByRole("dialog").getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Empty book" }).click();
    await page.getByRole("button", { name: "Upload files" }).waitFor();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload files" }).click();
    await (await chooser).setFiles({ name: "big.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(1.5 * 1024 * 1024) });
    await page.getByText(/over your storage limit/).waitFor();

    await page.goto(`${server.origin}/account`);
    await page.getByRole("heading", { name: "Storage" }).waitFor();
    await page.getByText(/ of 1 MB/).waitFor();
  }, 60_000);
});

