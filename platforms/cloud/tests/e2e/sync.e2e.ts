import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

/*
 * Someone else saves (here: straight through the API, as a git push would
 * move main) while the editor is open: a file without unsaved text follows
 * in place, a file with unsaved text gets a bar and merges.
 */

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  const context = await browser.newContext({ locale: "en-US" });
  page = await context.newPage();
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

/** Saves `edit(text)` of `path` as someone else would: a commit on main. */
async function saveElsewhere(bookId: string, path: string, edit: (text: string) => string) {
  const listing = await (await page.request.get(`${server.origin}/api/books/${bookId}/files`)).json();
  const oid = listing.files.find((f: { path: string }) => f.path === path).oid;
  const raw = await page.request.get(`${server.origin}/api/books/${bookId}/files/raw?path=${encodeURIComponent(path)}`);
  const res = await page.request.post(`${server.origin}/api/books/${bookId}/files/commit`, {
    headers: { origin: server.origin },
    data: { changes: [{ op: "write", path, content: edit(await raw.text()), baseOid: oid }] },
  });
  expect(res.status()).toBe(200);
}

describe("editor sync", () => {
  it("follows saves made elsewhere, and merges them into unsaved text", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Tides");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();
    const editor = page.locator(".cm-content");
    await editor.getByText("# Tides").waitFor();
    const bookId = /\/books\/(\d+)\/edit/.exec(page.url())![1]!;
    const path = "book/index.md";

    // No unsaved text: the editor takes the new version in place.
    await saveElsewhere(bookId, path, (text) => text.replace("# Tides", "# Tides and moon"));
    await editor.getByText("# Tides and moon").waitFor();
    await page.getByText(/^Updated with changes by .*book\/index\.md/).waitFor();

    // Unsaved text at the top; someone else adds a line at the end.
    await editor.getByText("# Tides and moon").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" (mine)");
    await page.getByTitle("Not saved").first().waitFor();
    await saveElsewhere(bookId, path, (text) => `${text.trimEnd()}\n\nAdded elsewhere.\n`);
    const bar = page.getByRole("alert").filter({ hasText: "changed this file while you were editing it" });
    await bar.waitFor();
    // The editor still holds only the teacher's text.
    expect(await editor.getByText("Added elsewhere.").count()).toBe(0);

    await bar.getByRole("button", { name: "Show changes and merge" }).click();
    const merge = page.getByRole("dialog", { name: `Merge ${path}` });
    await merge.getByText("+Added elsewhere.").waitFor();
    await merge.getByText(/do not overlap/).waitFor();
    await merge.getByRole("button", { name: "Merge", exact: true }).click();

    await editor.getByText("# Tides and moon (mine)").waitFor();
    await editor.getByText("Added elsewhere.").waitFor();
    await bar.waitFor({ state: "detached" });

    // Saved on top of their version: no conflict.
    await page.keyboard.press("Control+s");
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });
    const saved = await (
      await page.request.get(`${server.origin}/api/books/${bookId}/files/raw?path=${encodeURIComponent(path)}`)
    ).text();
    expect(saved).toContain("# Tides and moon (mine)");
    expect(saved).toContain("Added elsewhere.");
  });

  it("marks what both changed, and asks before saving markers", async () => {
    const editor = page.locator(".cm-content");
    const bookId = /\/books\/(\d+)\/edit/.exec(page.url())![1]!;
    const path = "book/index.md";

    // Both change the heading.
    await editor.getByText("# Tides and moon (mine)").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" again");
    await page.getByTitle("Not saved").first().waitFor();
    await saveElsewhere(bookId, path, (text) => text.replace("# Tides and moon (mine)", "# Their heading"));
    const bar = page.getByRole("alert").filter({ hasText: "changed this file while you were editing it" });
    await bar.getByRole("button", { name: "Show changes and merge" }).click();
    const merge = page.getByRole("dialog", { name: `Merge ${path}` });
    await merge.getByText(/1 place was changed by both of you/).waitFor();
    await merge.getByRole("button", { name: "Merge", exact: true }).click();

    await editor.getByText("<<<<<<< your version").waitFor();
    await editor.getByText("# Tides and moon (mine) again").waitFor();
    await editor.getByText("# Their heading").waitFor();
    await editor.getByText(">>>>>>> their version").waitFor();

    // Saving with markers left asks first; cancelled, nothing is saved.
    await page.keyboard.press("Control+s");
    const ask = page.getByRole("dialog").filter({ hasText: "still has conflict markers" });
    await ask.getByRole("button", { name: "Cancel" }).click();
    await page.getByTitle("Not saved").first().waitFor();
    const raw = await page.request.get(`${server.origin}/api/books/${bookId}/files/raw?path=${encodeURIComponent(path)}`);
    expect(await raw.text()).not.toContain("<<<<<<<");
  });
});
