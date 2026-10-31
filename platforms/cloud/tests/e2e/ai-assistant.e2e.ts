import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

/*
 * The AI assistant in the editor, against the built server and a fake
 * OpenAI-compatible provider (platforms/cloud/docs/cloud-ai-assistant.md). The provider
 * streams a scripted answer; the test checks the editor's whole flow: ask,
 * stream, insert, save.
 */

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;
let provider: { url: string; close: () => Promise<void> };

/** What "Fix the page" proposes as the page's new text. */
const FIXED_PAGE = `---
name: Fixed
---

# Fixed

Rewritten by the assistant.
`;

/**
 * A chat-completions endpoint that answers "Hello world" as deltas — and,
 * when asked to make a quiz or to fix the page, records a write_file first,
 * as a model with tools would. "Fix the page" holds its tool round open
 * for a moment, so a test can edit the page while the request runs — the
 * proposal then was built against a buffer that no longer exists.
 */
async function startProvider() {
  const app = new Hono();
  app.post("/v1/chat/completions", async (c) => {
    const body = await c.req.json();
    const lastUser = body.messages.findLast(
      (message: { role: string }) => message.role === "user",
    );
    const job =
      typeof lastUser?.content === "string"
        ? ((["Make a quiz", "Fix the page"] as const).find((prompt) =>
            lastUser.content.includes(prompt),
          ) ?? null)
        : null;
    // The first call of a tool round ends at finish_reason "tool_calls";
    // the answer comes only once the tool's result is in the messages.
    const inToolRound =
      job !== null &&
      !body.messages.some(
        (message: { role: string }) => message.role === "tool",
      );
    const encoder = new TextEncoder();
    const chunk = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;
    const toolCall = (path: string, content: string) =>
      chunk({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: {
                    name: "write_file",
                    arguments: JSON.stringify({ path, content }),
                  },
                },
              ],
            },
          },
        ],
      }) + chunk({ choices: [{ delta: {}, finish_reason: "tool_calls" }] });
    const answer =
      ["Hello", " ", "world"]
        .map((text) => chunk({ choices: [{ delta: { content: text } }] }))
        .join("") +
      chunk({ choices: [{ delta: {}, finish_reason: "stop" }] }) +
      "data: [DONE]\n\n";
    const chunks = !inToolRound
      ? answer
      : job === "Make a quiz"
        ? toolCall("quiz/hello.json", '{"hello":1}') + answer
        : toolCall("book/index.md", FIXED_PAGE) + answer;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = () => {
          controller.enqueue(encoder.encode(chunks));
          controller.close();
        };
        // The held-open first round is the window in which the teacher
        // (the test) edits the page the proposal is built against.
        if (job === "Fix the page" && inToolRound) setTimeout(send, 3000);
        else send();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  });
  const http = serve({ fetch: app.fetch, port: 0 });
  const address = http.address();
  if (typeof address !== "object" || !address) throw new Error("no port");
  return {
    url: `http://localhost:${address.port}/v1`,
    close: () => new Promise<void>((resolve) => http.close(() => resolve())),
  };
}

beforeAll(async () => {
  provider = await startProvider();
  server = await startServer({
    AI_BASE_URL: provider.url,
    AI_API_KEY: "e2e-key",
    AI_MODEL: "mistral-test",
  });
  browser = await launchBrowser();
  page = await browser.newPage({ locale: "en-US" });
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  await provider?.close();
});

describe("AI assistant", () => {
  it("answers a request and streams it into the chat", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Assisted");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();

    // The assistant's pane opens with the model and the day's requests.
    await page.getByRole("button", { name: "Show the AI assistant" }).click();
    const panel = page.getByRole("region", { name: "AI assistant" });
    await panel.getByText("Model: mistral-test").waitFor();
    await panel.getByText("0 requests today").waitFor();

    // Ask for something; the answer streams in live.
    await panel
      .getByPlaceholder("Ask about this page — or select text first…")
      .fill("Say hello");
    await panel.getByRole("button", { name: "Ask" }).click();
    await panel.getByText("Hello world").waitFor();

    // The answer is a suggestion to copy, not an edit: the page is untouched,
    // and each message carries a copy button.
    const editor = page.locator(".cm-content");
    expect(await editor.textContent()).not.toContain("Hello world");
    await panel.getByRole("button", { name: "Copy" }).first().waitFor();

    // The request was counted.
    await panel.getByText("1 requests today").waitFor();
  }, 120_000);

  it("sends the selection along with a free request", async () => {
    // The same editor, with the assistant's pane still open.
    const panel = page.getByRole("region", { name: "AI assistant" });

    // Select the page's heading and ask about the selection in the chat.
    const editor = page.locator(".cm-content");
    await editor.getByText("# Assisted").click();
    await page.keyboard.press("Control+a");
    await panel
      .getByPlaceholder("Ask about this page — or select text first…")
      .fill("Improve the selected text");
    await panel.getByRole("button", { name: "Ask" }).click();
    await panel.getByText("Hello world").waitFor();

    // Still only a suggestion: the page itself is unchanged.
    expect(await editor.textContent()).toContain("# Assisted");
  }, 120_000);

  it("proposes a new file, reviewed as a diff and applied on acceptance", async () => {
    // A fresh book, so its file list is empty of quizzes.
    await page.goto(`${server.origin}/books`);
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Quizzes");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();
    await page.getByRole("button", { name: "Show the AI assistant" }).click();
    const panel = page.getByRole("region", { name: "AI assistant" });

    // The model records a write_file; the answer streams and the proposal
    // opens its review dialog with the diff.
    await panel
      .getByPlaceholder("Ask about this page — or select text first…")
      .fill("Make a quiz");
    await panel.getByRole("button", { name: "Ask" }).click();
    const review = page.getByRole("dialog");
    await review.getByText("quiz/hello.json", { exact: true }).waitFor();
    await review.getByText("new file", { exact: true }).waitFor();
    expect(await review.getByText('+{"hello":1}').count()).toBe(1);

    // Accept: the file is committed (one ordinary save), the tree follows.
    await review.getByRole("button", { name: "Accept 1 change" }).click();
    // The tree follows the commit; folders are open by default.
    await page.getByRole("button", { name: "hello.json" }).click();
    await page.getByRole("tab", { name: "hello.json" }).waitFor();
    // The quiz opens in its own tab; its editor shows the proposed content.
    await page
      .locator(".cm-content")
      .filter({ hasText: '"hello":1' })
      .waitFor();
  }, 120_000);

  it("blocks a proposal whose page changed while the request ran", async () => {
    // A fresh book, so the open page is the template's book/index.md.
    await page.goto(`${server.origin}/books`);
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Guarded");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();
    await page.getByRole("button", { name: "Show the AI assistant" }).click();
    const panel = page.getByRole("region", { name: "AI assistant" });

    // The assistant proposes to rewrite the open page — and the request
    // holds its tool round, so there is time to edit the page meanwhile.
    await panel
      .getByPlaceholder("Ask about this page — or select text first…")
      .fill("Fix the page");
    await panel.getByRole("button", { name: "Ask" }).click();
    const editor = page.locator(".cm-content");
    // The request is underway now; replace the page while it runs.
    await panel.getByRole("button", { name: "Stop" }).waitFor();
    await editor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.insertText("Changed while the assistant worked.");

    // The proposal reviews the page as it was sent; the buffer is not that
    // anymore, so accepting must change nothing — the typed text stays.
    const review = page.getByRole("dialog");
    await review.getByText("book/index.md", { exact: true }).waitFor();
    await review.getByRole("button", { name: "Accept 1 change" }).click();
    await page.getByText(/changed since the answer/).waitFor();
    const text = (await editor.textContent()) ?? "";
    expect(text.trim()).toBe("Changed while the assistant worked.");
    // Nothing was applied, so nothing was committed either.
    await page.getByTitle("Not saved").first().waitFor();
  }, 120_000);

});
