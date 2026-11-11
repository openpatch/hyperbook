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
  page = await (await browser.newContext({ locale: "en-US" })).newPage();
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

/** Selects the whole line that holds `text` in the open file's editor. */
async function selectLine(p: Page, text: string) {
  await p.locator(".cm-content").getByText(text).first().click();
  await p.keyboard.press("Home");
  await p.keyboard.press("Shift+End");
}

describe("review", () => {
  it("lets someone with a named link comment, and the owner answer", async () => {
    // A book with pages.
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Optics");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();
    await page.locator(".cm-content").getByText("# Optics").waitFor();
    const bookUrl = page.url().replace(/\/edit$/, "");

    // The owner makes a link for Anna.
    await page.goto(bookUrl);
    await page.getByLabel("Name", { exact: true }).fill("Anna");
    await page.getByRole("button", { name: "Create link" }).click();
    const url = (await page.getByTestId("secret").textContent())!.trim();
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("cell", { name: "Anna", exact: true }).waitFor();

    // Anna opens it without an account and lands in the editor.
    const anna = await (await browser.newContext({ locale: "en-US" })).newPage();
    await anna.goto(url);
    await anna.waitForURL(/\/books\/\d+\/edit$/);
    await anna.getByText("Commenting as Anna").waitFor();
    await anna.getByRole("button", { name: "Got it" }).click();
    await anna.locator(".cm-content").getByText("# Optics").waitFor();
    // No saving, no AI, no settings for a commenter.
    await anna.getByRole("button", { name: "Save all" }).waitFor({ state: "detached" });
    await anna.getByRole("button", { name: "Book settings" }).waitFor({ state: "detached" });

    // She selects the title and comments on it.
    await selectLine(anna, "# Optics");
    await anna.locator(".cm-comment-tooltip").getByRole("button", { name: "Comment" }).click();
    const pane = anna.getByRole("region", { name: "Comments" });
    await pane.getByLabel("Write a comment… (Markdown works)").fill("Maybe **Light and optics**?");
    await pane.getByRole("button", { name: "Comment", exact: true }).click();
    await pane.getByText("Light and optics").waitFor();
    await anna.locator(".cm-comment").first().waitFor();
    // Typing changes nothing in a commenter's editor.
    await anna.keyboard.type("xyz");
    await anna.getByTitle("Not saved").first().waitFor({ state: "detached" });

    // The owner sees the thread in the editor and resolves it with a reply.
    await page.goto(`${bookUrl}/edit`);
    await page.getByRole("button", { name: "Show comments" }).click();
    const ownerPane = page.getByRole("region", { name: "Comments" });
    await ownerPane.getByText("Light and optics").waitFor();
    await ownerPane.getByLabel("Reply…").fill("Good idea");
    await ownerPane.getByRole("button", { name: "Reply" }).click();
    await ownerPane.getByText("Good idea").waitFor();
    await ownerPane.getByRole("button", { name: "Resolve" }).click();
    await ownerPane.getByRole("button", { name: "Resolved (1)" }).waitFor();

    // Anna leaves; the link would bring her back.
    await anna.getByRole("button", { name: "Leave" }).click();
    await anna.waitForURL(/\/join\?left/);
    await anna.getByText("You left the book.").waitFor();

    // Deleted by the owner, the link opens nothing anymore.
    await page.goto(bookUrl);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await page.getByText("No links yet.").waitFor();
    await anna.goto(url);
    await anna.getByText("This link no longer works").waitFor();
  });

  it("keeps a thread on its text through edits, undo and a save, and applies suggestions", async () => {
    await page.goto(`${server.origin}/books`);
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Lenses");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();
    const editor = page.locator(".cm-content");
    await editor.getByText("# Lenses").waitFor();

    // A suggestion on the title.
    await selectLine(page, "# Lenses");
    await page.locator(".cm-comment-tooltip").getByRole("button", { name: "Comment" }).click();
    const pane = page.getByRole("region", { name: "Comments" });
    await pane.getByLabel("Write a comment… (Markdown works)").fill("Shorter?");
    await pane.getByText("Suggest a change").click();
    await pane.getByLabel("Replace the text with").fill("# Lens");
    await pane.getByRole("button", { name: "Comment", exact: true }).click();
    await page.locator(".cm-comment").getByText("# Lenses").waitFor();

    // Typing above it moves the mark along; deleting its text and undoing
    // brings the mark back.
    await editor.getByText("# Lenses").click();
    await page.keyboard.press("Home");
    await page.keyboard.type("Intro\n\n");
    await page.locator(".cm-comment").getByText("# Lenses").waitFor();
    await selectLine(page, "# Lenses");
    await page.keyboard.press("Delete");
    await page.locator(".cm-comment").waitFor({ state: "detached" });
    await page.keyboard.press("Control+z");
    await page.locator(".cm-comment").getByText("# Lenses").waitFor();

    // Saved, and opened again: the server knows where the thread went.
    await page.keyboard.press("Control+s");
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });
    await page.reload();
    await page.locator(".cm-comment").getByText("# Lenses").waitFor();

    // Applying the suggestion edits the text and resolves the thread.
    await page.getByRole("button", { name: "Show comments" }).click();
    await page.getByRole("region", { name: "Comments" }).getByRole("button", { name: "Apply" }).click();
    await editor.getByText("# Lens", { exact: true }).waitFor();
    await page.getByRole("region", { name: "Comments" }).getByRole("button", { name: "Resolved (1)" }).waitFor();
    await page.getByTitle("Not saved").first().waitFor();
  });
});
