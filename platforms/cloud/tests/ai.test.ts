import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { auditLog } from "../src/server/db/schema";
import { clearDocumentationCache } from "../src/server/ai/docs";
import { loggedIn, setup } from "./helpers";

/*
 * A fake OpenAI-compatible provider: a chat-completions endpoint on an
 * ephemeral port that streams scripted deltas and records what it was
 * asked. The real providers all speak this protocol (platforms/cloud/docs/cloud-ai-assistant.md).
 */

type Asked = {
  model: string;
  messages: { role: string; content: unknown }[];
  maxTokens: number;
  tools?: unknown;
  cacheKey?: string;
};

type Answer =
  | { deltas: string[]; reasoning?: string[]; finish?: "stop" | "length" }
  | {
      toolCalls: { name: string; args: unknown }[];
      reasoning?: string[];
      finish?: "length";
    }
  | { error: number };

/** A queue of answers, one per provider call; the last repeats. */
class Script {
  constructor(readonly answers: Answer[]) {}
  private index = 0;
  next(asked: Asked): Answer {
    // A provider that rejects tools outright, like a small local model:
    // every request with tools fails, the first one without goes on.
    const peeked = this.peek();
    if ("error" in peeked && peeked.error === 400) {
      if (asked.tools !== undefined) return { error: 400 };
      this.index += 1;
    }
    const answer = this.answers[Math.min(this.index, this.answers.length - 1)]!;
    this.index += 1;
    return answer;
  }
  private peek(): Answer {
    return this.answers[Math.min(this.index, this.answers.length - 1)]!;
  }
}

function fakeProvider(script: (asked: Asked) => Answer) {
  const asked: Asked[] = [];
  const app = new Hono();
  app.post("/v1/chat/completions", async (c) => {
    const body = await c.req.json();
    const request: Asked = {
      model: body.model,
      messages: body.messages,
      maxTokens: body.max_tokens,
      tools: body.tools,
      cacheKey: body.prompt_cache_key,
    };
    asked.push(request);
    const answer = script(request);
    if ("error" in answer) return c.json({ error: "no" }, answer.error as 500);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if ("toolCalls" in answer) {
          for (const text of answer.reasoning ?? []) {
            const chunk = JSON.stringify({
              choices: [{ delta: { reasoning_content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          answer.toolCalls.forEach((call, index) => {
            const chunk = JSON.stringify({
              choices: [
                {
                  delta: {
                    tool_calls: [
                      {
                        index,
                        id: `call_${index + 1}`,
                        function: {
                          name: call.name,
                          arguments: JSON.stringify(call.args),
                        },
                      },
                    ],
                  },
                },
              ],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          });
          const done = JSON.stringify({
            choices: [{ delta: {}, finish_reason: answer.finish ?? "tool_calls" }],
          });
          // Providers that honour include_usage end with a usage chunk;
          // Mistral reports prefix-cache hits in prompt_tokens_details.
          const usage = JSON.stringify({
            choices: [],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              prompt_tokens_details: { cached_tokens: 40 },
            },
          });
          controller.enqueue(
            encoder.encode(`data: ${done}\n\ndata: ${usage}\n\ndata: [DONE]\n\n`),
          );
        } else {
          for (const text of answer.reasoning ?? []) {
            const chunk = JSON.stringify({
              choices: [{ delta: { reasoning_content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          for (const text of answer.deltas) {
            const chunk = JSON.stringify({
              choices: [{ delta: { content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          const done = JSON.stringify({
            choices: [{ delta: {}, finish_reason: answer.finish ?? "stop" }],
          });
          // Providers that honour include_usage end with a usage chunk;
          // Mistral reports prefix-cache hits in prompt_tokens_details.
          const usage = JSON.stringify({
            choices: [],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              prompt_tokens_details: { cached_tokens: 40 },
            },
          });
          controller.enqueue(
            encoder.encode(`data: ${done}\n\ndata: ${usage}\n\ndata: [DONE]\n\n`),
          );
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  });
  const server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  const url =
    typeof address === "object" && address
      ? `http://localhost:${address.port}/v1`
      : "";
  const close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  return { url, asked, close };
}

/** The events of one streamed answer, as the editor parses them. */
function events(body: string): { event: string; data: any }[] {
  const out: { event: string; data: any }[] = [];
  for (const raw of body.split("\n\n")) {
    const event = /^event: (.*)$/m.exec(raw)?.[1];
    const data = /^data: (.*)$/m.exec(raw)?.[1];
    if (event && data) out.push({ event, data: JSON.parse(data) });
  }
  return out;
}

const providers: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const provider of providers.splice(0)) await provider.close();
});

/** An instance with AI on, a teacher, their book, and the assist path. */
async function world(
  env: Record<string, string> = {},
  script: (asked: Asked) => Answer = () => ({
    deltas: ["Hello", " ", "world"],
  }),
  files: Record<string, string> = {},
) {
  const provider = fakeProvider(script);
  providers.push(provider);
  const instance = setup({
    AI_BASE_URL: provider.url,
    AI_API_KEY: "test-key",
    AI_MODEL: "mistral-test",
    ...env,
  });
  const owner = await loggedIn(instance, {
    email: "o@example.org",
    displayName: "Owner",
  });
  const other = await loggedIn(instance, { email: "x@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
  ).body;
  if (Object.keys(files).length > 0) {
    const res = await owner.c.post(`/api/books/${book.id}/files/commit`, {
      message: "init",
      changes: Object.entries(files).map(([path, content]) => ({
        op: "write",
        path,
        content,
        encoding: "utf8",
        baseOid: null,
      })),
    });
    if (res.status !== 200)
      throw new Error(`commit failed: ${JSON.stringify(res.body)}`);
  }
  const assist = `/api/books/${book.id}/ai/assist`;
  return { provider, instance, owner, other, book, assist };
}

describe("AI status", () => {
  it("is off without configuration", async () => {
    const instance = setup();
    const user = await loggedIn(instance, { email: "u@example.org" });
    expect((await user.c.get("/api/ai")).body).toEqual({
      enabled: false,
      model: null,
      models: [],
      modelLabels: {},
      modelWeights: {},
      allowed: true,
      usedToday: 0,
      quota: null,
      tokensUsedThisWeek: 0,
      tokenQuota: null,
      tokensResetOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("shows the model when configured", async () => {
    const { owner } = await world();
    expect((await owner.c.get("/api/ai")).body).toEqual({
      enabled: true,
      model: "mistral-test",
      models: ["mistral-test"],
      modelLabels: {},
      modelWeights: { "mistral-test": { in: 1, cached: 1, out: 1 } },
      allowed: true,
      usedToday: 0,
      quota: null,
      tokensUsedThisWeek: 0,
      tokenQuota: null,
      tokensResetOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it("needs a login", async () => {
    const instance = setup();
    const res = await instance.app.request("/api/ai", {
      headers: { host: "admin.test" },
    });
    expect(res.status).toBe(401);
  });
});

describe("AI assist", () => {
  it("streams deltas and done, and asks the provider in the book's terms", async () => {
    const { owner, provider, assist } = await world();
    const res = await owner.c.post(assist, {
      prompt: "Say hi",
      pagePath: "book/index.md",
      context: "# Physics\n\nWelcome.",
    });
    expect(res.status).toBe(200);
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual([
      "conversation",
      "delta",
      "delta",
      "delta",
      "usage",
      "done",
    ]);
    // A new conversation, named after the request.
    expect(seen[0]!.data).toMatchObject({ title: "Say hi" });
    expect(seen[1]!.data).toEqual({ text: "Hello" });
    // The done event also tells what the answer cost the weekly quota.
    expect(seen[5]!.data).toMatchObject({
      finish: "stop",
      messageId: expect.any(Number),
      durationMs: expect.any(Number),
      usage: { tokensIn: 100, tokensCached: 40, tokensOut: 20, credits: 120 },
    });

    // The provider saw the key and the model, and a message pair that
    // knows the book: system prompt, hyperbook conventions, the page.
    expect(provider.asked).toHaveLength(1);
    const [asked] = provider.asked;
    expect(asked!.model).toBe("mistral-test");
    expect(asked!.maxTokens).toBe(65536);
    expect(asked!.messages).toHaveLength(2);
    expect(asked!.messages[0]!.role).toBe("system");
    expect(String(asked!.messages[0]!.content)).toMatch(/hyperbook/i);
    expect(String(asked!.messages[0]!.content)).toMatch(/Language: en/);
    expect(String(asked!.messages[1]!.content)).toContain("book/index.md");
    expect(String(asked!.messages[1]!.content)).toContain("# Physics");
    expect(String(asked!.messages[1]!.content)).toContain("Say hi");
  });

  it("keeps the conversation and sends its earlier turns along, oldest first", async () => {
    let call = 0;
    const { owner, provider, assist, book } = await world({}, () => ({
      deltas: [call++ === 0 ? "I wrote book/arctic-fox.md about the arctic fox." : "Done."],
    }));
    const first = await owner.c.post(assist, {
      prompt: "Write me a page about an arctic fox",
      pagePath: "book/index.md",
    });
    const conversation = events(first.body)[0]!.data;
    const res = await owner.c.post(assist, {
      prompt: "Write about a related animal",
      pagePath: "book/index.md",
      conversationId: conversation.id,
    });
    expect(res.status).toBe(200);
    // The pair from before, between the system prompt and this request.
    const asked = provider.asked[1]!;
    expect(asked.messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(String(asked.messages[1]!.content)).toContain("arctic fox");
    expect(String(asked.messages[2]!.content)).toContain("arctic-fox.md");
    expect(String(asked.messages[3]!.content)).toContain(
      "Write about a related animal",
    );

    // The editor lists it, and loads all four messages back.
    const list = await owner.c.get(`/api/books/${book.id}/ai/conversations`);
    expect(list.body.conversations).toEqual([
      expect.objectContaining({ id: conversation.id, title: "Write me a page about an arctic fox" }),
    ]);
    const loaded = await owner.c.get(
      `/api/books/${book.id}/ai/conversations/${conversation.id}`,
    );
    expect(loaded.body.messages.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ["user", "Write me a page about an arctic fox"],
      ["assistant", "I wrote book/arctic-fox.md about the arctic fox."],
      ["user", "Write about a related animal"],
      ["assistant", "Done."],
    ]);
    expect(loaded.body.messages[1]).toMatchObject({ finish: "stop", model: "mistral-test", credits: 120 });
  });

  it("shortens a long earlier answer in the history instead of resending it whole", async () => {
    let call = 0;
    const { owner, provider, assist } = await world({}, () => ({
      deltas: [call++ === 0 ? "f".repeat(13_000) : "ok"],
    }));
    const first = await owner.c.post(assist, { prompt: "Write a lot", pagePath: "book/index.md" });
    await owner.c.post(assist, {
      prompt: "And now a related animal",
      pagePath: "book/index.md",
      conversationId: events(first.body)[0]!.data.id,
    });
    const earlier = provider.asked[1]!.messages.find((m) => m.role === "assistant")!;
    expect(String(earlier.content).length).toBeLessThan(12_100);
    expect(String(earlier.content)).toContain("(shortened)");
  });

  it("keeps conversations to the teacher who had them", async () => {
    const { owner, other, book, assist } = await world();
    const first = await owner.c.post(assist, { prompt: "Hi", pagePath: "book/index.md" });
    const id = events(first.body)[0]!.data.id;
    // Another editor of the book sees neither the conversation nor its list entry.
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    expect((await other.c.get(`/api/books/${book.id}/ai/conversations`)).body.conversations ?? []).toEqual([]);
    expect((await other.c.get(`/api/books/${book.id}/ai/conversations/${id}`)).status).toBe(404);
    const foreign = await other.c.post(assist, {
      prompt: "Hi",
      pagePath: "book/index.md",
      conversationId: id,
    });
    expect(foreign.status).toBe(404);

    // Its owner renames and deletes it.
    expect((await owner.c.patch(`/api/books/${book.id}/ai/conversations/${id}`, { title: "Greeting" })).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}/ai/conversations`)).body.conversations[0].title).toBe("Greeting");
    expect((await owner.c.delete(`/api/books/${book.id}/ai/conversations/${id}`)).status).toBe(200);
    expect((await owner.c.get(`/api/books/${book.id}/ai/conversations`)).body.conversations).toEqual([]);
  });

  it("replaces an edited message and everything after it", async () => {
    let call = 0;
    const { owner, provider, assist, book } = await world({}, () => ({
      deltas: [`answer ${++call}`],
    }));
    const first = await owner.c.post(assist, { prompt: "Write about foxes", pagePath: "book/index.md" });
    const { id, userMessageId } = events(first.body)[0]!.data;
    await owner.c.post(assist, { prompt: "More", pagePath: "book/index.md", conversationId: id });
    // Edit the first message: both exchanges go, the edited one replaces them.
    const edited = await owner.c.post(assist, {
      prompt: "Write about wolves",
      pagePath: "book/index.md",
      conversationId: id,
      replaceFrom: userMessageId,
    });
    expect(edited.status).toBe(200);
    expect(provider.asked[2]!.messages.map((m) => m.role)).toEqual(["system", "user"]);
    const loaded = await owner.c.get(`/api/books/${book.id}/ai/conversations/${id}`);
    expect(loaded.body.messages.map((m: { content: string }) => m.content)).toEqual([
      "Write about wolves",
      "answer 3",
    ]);
  });

  it("sends a prompt cache key that is stable while the book's head commit is", async () => {
    const { owner, provider, assist } = await world({}, undefined, {
      "book/index.md": "# Physics\n",
    });
    const post = () =>
      owner.c.post(assist, {
        prompt: "Say hi",
        pagePath: "book/index.md",
      });
    await post();
    await post();
    expect(provider.asked).toHaveLength(2);
    // Keyed on the head commit, so providers with prompt caching (Mistral)
    // reuse the shared system-prompt prefix across requests to this book.
    const key = provider.asked[0]!.cacheKey;
    expect(key).toMatch(/^hyperbook:[0-9a-f]{7,40}$/);
    expect(provider.asked[1]!.cacheKey).toBe(key);
  });

  it("calls the model the teacher picked when the instance allows it, else the default", async () => {
    const { owner, provider, assist } = await world({
      AI_MODELS: "zai-glm-5-3, zai-glm-5-3-flash, mistral-large-4",
    });
    expect((await owner.c.get("/api/ai")).body.models).toEqual([
      "mistral-test",
      "zai-glm-5-3",
      "zai-glm-5-3-flash",
      "mistral-large-4",
    ]);
    const post = (model?: string) =>
      owner.c.post(assist, {
        prompt: "Say hi",
        pagePath: "book/index.md",
        ...(model ? { model } : {}),
      });

    // An allowed pick reaches the provider.
    let res = await post("zai-glm-5-3-flash");
    expect(res.status).toBe(200);
    expect(provider.asked.at(-1)!.model).toBe("zai-glm-5-3-flash");

    // A name outside the instance's list is not called; the default is.
    res = await post("some-other-model");
    expect(res.status).toBe(200);
    expect(provider.asked.at(-1)!.model).toBe("mistral-test");

    // No pick: the default.
    res = await post();
    expect(res.status).toBe(200);
    expect(provider.asked.at(-1)!.model).toBe("mistral-test");
  });

  it("lets the model read local documentation with read_docs", async () => {
    clearDocumentationCache();
    const { owner, provider, assist } = await world({}, (asked) =>
      asked.messages.some((m) => m.role === "tool")
        ? { deltas: ["ok"] }
        : { toolCalls: [{ name: "read_docs", args: { name: "bitflow" } }] },
    );
    const res = await owner.c.post(assist, {
      prompt: "How do I write a quiz?",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    // The tool ran, its event streamed, and the model got the local doc file.
    expect(events(res.body).map((e) => e.event)).toContain("tool");
    const toolMessage = provider.asked[1]!.messages.find((m) => m.role === "tool");
    expect(String(toolMessage!.content)).toContain(".bitflow");
  });

  it("passes the selection and the page's context only", async () => {
    const { owner, provider, assist } = await world();
    const res = await owner.c.post(assist, {
      prompt: "Improve the passage",
      pagePath: "book/lists.md",
      selection: "A linked list is …",
    });
    expect(res.status).toBe(200);
    const user = provider.asked[0]!.messages[1]!;
    expect(String(user.content)).toContain("A linked list is …");
    expect(String(user.content)).toContain("Improve the passage");
  });

  it("answers 503 when AI is off", async () => {
    const instance = setup();
    const owner = await loggedIn(instance, { email: "o@example.org" });
    const book = (await owner.c.post("/api/books", { title: "P", slug: "p" }))
      .body;
    const res = await owner.c.post(`/api/books/${book.id}/ai/assist`, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("hides books the teacher does not edit", async () => {
    const { other, assist } = await world();
    const res = await other.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a request without a prompt, and bad paths", async () => {
    const { owner, assist } = await world();
    const noPrompt = await owner.c.post(assist, {
      pagePath: "book/index.md",
    });
    expect(noPrompt.status).toBe(400);
    expect(noPrompt.body.issues[0].path).toBe("prompt");
    const badPath = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "../outside.md",
    });
    expect(badPath.status).toBe(400);
  });

  it("rate limits per teacher", async () => {
    const { owner, other, assist } = await world({
      AI_REQUESTS_PER_MINUTE: "2",
    });
    const body = { prompt: "Continue the page", pagePath: "book/index.md" };
    expect((await owner.c.post(assist, body)).status).toBe(200);
    expect((await owner.c.post(assist, body)).status).toBe(200);
    expect((await owner.c.post(assist, body)).status).toBe(429);
    // Another teacher is not affected.
    const theirBook = (
      await other.c.post("/api/books", { title: "B", slug: "b" })
    ).body;
    expect(
      (await other.c.post(`/api/books/${theirBook.id}/ai/assist`, body)).status,
    ).toBe(200);
  });

  it("can be disabled per teacher, and shows that in the status", async () => {
    const { owner, instance, assist } = await world();
    const admin = await loggedIn(instance, {
      email: "admin@example.org",
      role: "admin",
    });
    expect(
      (
        await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {
          ai: false,
        })
      ).status,
    ).toBe(200);

    const status = (await owner.c.get("/api/ai")).body;
    expect(status.enabled).toBe(true);
    expect(status.allowed).toBe(false);

    const res = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
    // Admins themselves are never limited.
    const adminBook = (
      await admin.c.post("/api/books", { title: "A", slug: "a" })
    ).body;
    expect(
      (
        await admin.c.post(`/api/books/${adminBook.id}/ai/assist`, {
          prompt: "Continue the page",
          pagePath: "book/index.md",
        })
      ).status,
    ).toBe(200);
  });

  it("enforces a per-day quota and counts accepted requests", async () => {
    const { owner, instance, assist } = await world();
    const admin = await loggedIn(instance, {
      email: "admin@example.org",
      role: "admin",
    });
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {
      ai_requests_per_day: 2,
    });
    const body = { prompt: "Continue the page", pagePath: "book/index.md" };

    expect((await owner.c.post(assist, body)).status).toBe(200);
    expect((await owner.c.post(assist, body)).status).toBe(200);
    expect((await owner.c.get("/api/ai")).body).toMatchObject({
      allowed: true,
      usedToday: 2,
      quota: 2,
    });

    const over = await owner.c.post(assist, body);
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/used up/i);
    // A rejected request does not count.
    expect((await owner.c.get("/api/ai")).body.usedToday).toBe(2);
  });

  it("meters weighted tokens per week and blocks once they are used up", async () => {
    const { owner, instance, assist } = await world({ AI_MODELS: "mistral-big" });
    const admin = await loggedIn(instance, {
      email: "admin@example.org",
      role: "admin",
    });
    // Weights come from the instance settings, not the environment. With
    // 1 credit = 1 µ€ and no buffer, a price of 4 €/M weighs 4.
    await admin.c.put("/api/instance", {
      aiModels: [
        { id: "mistral-test", prices: { in: 1, cached: 1, out: 1 } },
        { id: "mistral-big", prices: { in: 4, cached: 2, out: 1 } },
      ],
      aiCreditValueEur: 0.000001,
      aiCostBuffer: 1,
    });
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {
      ai_tokens_per_week: 500,
    });
    const body = {
      prompt: "Continue the page",
      pagePath: "book/index.md",
      model: "mistral-big",
    };
    // 100 prompt tokens of which 40 were cache hits, 20 out, at weights
    // in/cached/out = 4/2/1: (100−40)×4 + 40×2 + 20×1 = 340 credits.
    const res = await owner.c.post(assist, body);
    expect(events(res.body).find((e) => e.event === "usage")!.data).toEqual({
      tokensUsedThisWeek: 340,
      tokenQuota: 500,
    });
    expect((await owner.c.get("/api/ai")).body).toMatchObject({
      modelWeights: {
        "mistral-test": { in: 1, cached: 1, out: 1 },
        "mistral-big": { in: 4, cached: 2, out: 1 },
      },
      tokensUsedThisWeek: 340,
      tokenQuota: 500,
    });
    // Under the quota, a request may overshoot it; the next one is refused.
    expect((await owner.c.post(assist, body)).status).toBe(200);
    const over = await owner.c.post(assist, body);
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/credits/i);
    // The week turns over: the credits refill.
    instance.db.run("UPDATE ai_usage SET day = '2000-01-01'");
    expect((await owner.c.post(assist, body)).status).toBe(200);
  });

  it("lets an admin choose the models, default and weights in the settings", async () => {
    const { owner, instance } = await world({ AI_MODELS: "mistral-big" });
    const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
    // Until something is saved, the environment's models show (no prices yet).
    expect((await admin.c.get("/api/instance")).body.ai).toEqual({
      configured: true,
      defaultModel: "mistral-test",
      creditValueEur: 0.01,
      costBuffer: 1.3,
      models: [
        { id: "mistral-test", prices: null, label: "" },
        { id: "mistral-big", prices: null, label: "" },
      ],
    });

    const bad = await admin.c.put("/api/instance", {
      aiModels: [{ id: "a", prices: { in: 1, cached: 1, out: 1 } }],
      aiDefaultModel: "b",
    });
    expect(bad.status).toBe(400);

    const ok = await admin.c.put("/api/instance", {
      aiModels: [
        { id: "mistral-large-4", prices: { in: 4.67, cached: 4.67, out: 3.5 } },
        { id: "zai-glm-5-3-flash", prices: { in: 1, cached: 2, out: 0.83 } },
      ],
      aiDefaultModel: "zai-glm-5-3-flash",
      aiCreditValueEur: 0.000001,
      aiCostBuffer: 1,
    });
    expect(ok.status).toBe(200);
    expect(await owner.c.get("/api/ai")).toMatchObject({
      body: {
        model: "zai-glm-5-3-flash",
        models: ["zai-glm-5-3-flash", "mistral-large-4"],
        modelWeights: {
          "mistral-large-4": { in: 4.67, cached: 4.67, out: 3.5 },
          "zai-glm-5-3-flash": { in: 1, cached: 2, out: 0.83 },
        },
      },
    });
  });

  it("shows an admin's alias for a model and monitors the usage", async () => {
    const { owner, other, instance, assist } = await world();
    const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
    expect(
      (
        await admin.c.put("/api/instance", {
          aiModels: [{ id: "mistral-test", prices: { in: 1, cached: 1, out: 1 }, label: "Fast" }],
        })
      ).status,
    ).toBe(200);
    expect((await owner.c.get("/api/ai")).body.modelLabels).toEqual({ "mistral-test": "Fast" });
    expect((await admin.c.get("/api/instance")).body.ai.models).toEqual([
      { id: "mistral-test", prices: { in: 1, cached: 1, out: 1 }, label: "Fast" },
    ]);

    await owner.c.post(assist, { prompt: "hi", pagePath: "book/index.md" });
    const monitor = (await admin.c.get("/api/ai-monitor?days=7")).body;
    expect(monitor.total.requests).toBe(1);
    expect(monitor.byModel).toMatchObject([{ model: "mistral-test", requests: 1 }]);
    expect(monitor.byUser).toMatchObject([{ email: "o@example.org", requests: 1 }]);
    const filtered = (await admin.c.get(`/api/ai-monitor?userId=${owner.user.id}`)).body;
    expect(filtered.total.requests).toBe(1);
    expect((await admin.c.get(`/api/ai-monitor?userId=${other.user.id}`)).body.total.requests).toBe(0);
    expect((await owner.c.get("/api/ai-monitor")).status).toBe(403);
  });

  it("refills the quota on a new UTC day", async () => {
    const { owner, instance, assist } = await world();
    const admin = await loggedIn(instance, {
      email: "admin@example.org",
      role: "admin",
    });
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {
      ai_requests_per_day: 1,
    });
    const body = { prompt: "Continue the page", pagePath: "book/index.md" };
    expect((await owner.c.post(assist, body)).status).toBe(200);
    expect((await owner.c.post(assist, body)).status).toBe(429);

    // A new UTC day refills the quota.
    instance.db.run("UPDATE ai_usage SET day = '2000-01-01'");
    expect((await owner.c.post(assist, body)).status).toBe(200);
  });

  it("reports a failing provider as an error event, and audits it", async () => {
    const { owner, provider, instance, assist } = await world({}, () => ({
      error: 500,
    }));
    const res = await owner.c.post(assist, {
      prompt: "hi",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200); // The stream started; the failure is an event.
    const seen = events(res.body);
    // The failed answer is kept in the conversation, so it can be retried.
    expect(seen.map((e) => e.event)).toEqual(["conversation", "error", "saved"]);
    expect(seen[1]!.data.code).toBe("status");
    expect(seen[1]!.data.message).toMatch(/did not answer/i);

    const entries = instance.db
      .select()
      .from(auditLog)
      .all()
      .filter((e) => e.action === "ai.assist");
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.action).toBe("ai.assist");
    expect(entry.data as Record<string, unknown>).toMatchObject({
      page: "book/index.md",
      model: "mistral-test",
      finish: "error",
    });
  });

  it("audits a successful request without its content", async () => {
    const { owner, instance, assist } = await world();
    await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
      context: "secret page text",
    });
    const entries = instance.db
      .select()
      .from(auditLog)
      .all()
      .filter((e) => e.action === "ai.assist");
    expect(entries).toHaveLength(1);
    const data = entries[0]!.data as Record<string, unknown>;
    expect(data).toMatchObject({
      page: "book/index.md",
      finish: "stop",
    });
    expect(JSON.stringify(data)).not.toContain("secret page text");
  });

  it("goes on after the token cap, and reports length only when that keeps happening", async () => {
    const { owner, provider, assist } = await world({}, () => ({
      deltas: ["partial"],
      finish: "length",
    }));
    const res = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    const seen = events(res.body);
    // The first call and three continuations, each told to go on where
    // its text stopped.
    expect(provider.asked).toHaveLength(4);
    const last = provider.asked[3]!.messages;
    expect(last.at(-2)).toEqual({ role: "assistant", content: "partial" });
    expect(String(last.at(-1)!.content)).toMatch(/Continue exactly where it stopped/);
    expect(seen.filter((e) => e.event === "delta")).toHaveLength(4);
    expect(seen.at(-1)).toMatchObject({
      event: "done",
      data: {
        finish: "length",
        usage: { tokensIn: 400, tokensCached: 160, tokensOut: 80, credits: 480 },
      },
    });
  });

  it("streams the thinking, and nudges a model whose thinking used up the cap", async () => {
    const answers: Answer[] = [
      { deltas: [], reasoning: ["Let me plan ", "the quiz…"], finish: "length" },
      { deltas: ["Here it is."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist, book } = await world({}, (asked) => s.next(asked));
    const res = await owner.c.post(assist, { prompt: "Make a quiz", pagePath: "book/index.md" });
    const seen = events(res.body);
    expect(seen.filter((e) => e.event === "reasoning").map((e) => e.data.text)).toEqual([
      "Let me plan ",
      "the quiz…",
    ]);
    // The thinking never becomes the answer.
    expect(seen.filter((e) => e.event === "delta").map((e) => e.data.text)).toEqual(["Here it is."]);
    expect(seen.at(-1)).toMatchObject({ event: "done", data: { finish: "stop" } });
    expect(String(provider.asked[1]!.messages.at(-1)!.content)).toMatch(/used up your output limit while thinking/);
    // The thinking is kept with the answer.
    const id = seen[0]!.data.id;
    const loaded = await owner.c.get(`/api/books/${book.id}/ai/conversations/${id}`);
    expect(loaded.body.messages[1]).toMatchObject({
      content: "Here it is.",
      reasoning: "Let me plan the quiz…",
    });
  });

  it("keeps each stretch of thinking apart, in order with the tools and the text", async () => {
    const answers: Answer[] = [
      { reasoning: ["I should read the exam."], toolCalls: [{ name: "list_files", args: {} }] },
      { deltas: ["Here are tasks."], reasoning: ["Now I know the format."] },
    ];
    const s = new Script(answers);
    const { owner, assist, book } = await world({}, (asked) => s.next(asked));
    const res = await owner.c.post(assist, { prompt: "More tasks", pagePath: "book/index.md" });
    const id = events(res.body)[0]!.data.id;
    const loaded = await owner.c.get(`/api/books/${book.id}/ai/conversations/${id}`);
    expect(
      loaded.body.messages[1].parts.map((p: { kind: string; text?: string; name?: string }) => [
        p.kind,
        p.text ?? p.name,
      ]),
    ).toEqual([
      ["thinking", "I should read the exam."],
      ["tool", "list_files"],
      ["thinking", "Now I know the format."],
      ["text", "Here are tasks."],
    ]);
    expect(loaded.body.messages[1].parts[0].ms).toEqual(expect.any(Number));
  });

  it("sends attached images as image parts and documents as text", async () => {
    const { owner, provider, assist } = await world();
    const res = await owner.c.post(assist, {
      prompt: "Make exercises like these",
      pagePath: "book/index.md",
      attachments: [
        { kind: "image", name: "exam.jpg", data: "data:image/jpeg;base64,AAAA" },
        { kind: "text", name: "exam.pdf", text: "Aufgabe 1: Steckbrief" },
      ],
    });
    expect(res.status).toBe(200);
    const content = provider.asked[0]!.messages.at(-1)!.content as {
      type: string;
      text?: string;
      image_url?: { url: string };
    }[];
    expect(content[0]!.type).toBe("text");
    expect(content[0]!.text).toContain("Attached document: exam.pdf");
    expect(content[0]!.text).toContain("Aufgabe 1: Steckbrief");
    expect(content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,AAAA" },
    });
  });

  it("rejects an attachment that is not an image data URL", async () => {
    const { owner, assist } = await world();
    const res = await owner.c.post(assist, {
      prompt: "Look",
      pagePath: "book/index.md",
      attachments: [{ kind: "image", name: "x", data: "https://example.org/x.png" }],
    });
    expect(res.status).toBe(400);
  });
});

describe("AI agent tools", () => {
  const script = (answers: Answer[]) => new Script(answers);

  it("drops big read results from the history after two more rounds", async () => {
    const big = "x".repeat(5000);
    const reads = ["book/a.md", "book/b.md", "book/c.md", "book/d.md"].map((path) => ({
      toolCalls: [{ name: "read_file", args: { path } }],
    }));
    const s = script([...reads, { deltas: ["done"] }]);
    const { owner, provider, assist } = await world({ AI_MAX_STEPS: "8" }, (asked) => s.next(asked), {
      "book/a.md": big,
      "book/b.md": big,
      "book/c.md": big,
      "book/d.md": big,
    });
    await owner.c.post(assist, { prompt: "read all", pagePath: "book/index.md" });
    const last = provider.asked.at(-1)!.messages.filter((m) => m.role === "tool").map((m) => String(m.content));
    expect(last).toHaveLength(4);
    expect(last[0]).toContain("dropped to save tokens");
    expect(last[1]).toContain("dropped to save tokens");
    expect(last[2]).toBe(big);
    expect(last[3]).toBe(big);
  });

  it("lets the model read a file, and passes the result back to it", async () => {
    const answers = [
      { toolCalls: [{ name: "read_file", args: { path: "book/index.md" } }] },
      { deltas: ["Answer"] },
    ];
    const s = script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      {
        "book/index.md": "# Physics\n\nWelcome.",
        "hyperbook.json": JSON.stringify({ name: "Physics", language: "de" }),
      },
    );
    const res = await owner.c.post(assist, {
      prompt: "What is the first heading?",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual([
      "conversation",
      "toolProgress",
      "usage",
      "tool",
      "delta",
      "usage",
      "done",
    ]);
    // While the call streamed in, and once it ran.
    expect(seen[1]!.data).toEqual({ name: "read_file", path: "book/index.md", chars: 24 });
    expect(seen[3]!.data).toEqual({ name: "read_file", detail: "book/index.md" });

    // Two provider calls: the second carries the tool's result, and the
    // first knew the book — its language and its files.
    expect(provider.asked).toHaveLength(2);
    expect(provider.asked[0]!.tools).toBeDefined();
    expect(String(provider.asked[0]!.messages[0]!.content)).toContain(
      "Language: de",
    );
    const toolMessage = provider.asked[1]!.messages.find(
      (m) => m.role === "tool",
    )!;
    expect(String(toolMessage.content)).toContain("# Physics");
  });

  it("reads several files in one call and does not resend a file it already read", async () => {
    const s = script([
      {
        toolCalls: [
          {
            name: "read_files",
            args: { paths: ["book/a.md", "book/b.md", "book/a.md"] },
          },
        ],
      },
      { toolCalls: [{ name: "read_file", args: { path: "book/a.md" } }] },
      { deltas: ["Done"] },
    ]);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      { "book/a.md": "Alpha text", "book/b.md": "Bravo text" },
    );
    const res = await owner.c.post(assist, {
      prompt: "Compare a and b",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    const tools = (n: number) =>
      provider.asked[n]!.messages.filter((m) => m.role === "tool").map((m) =>
        String(m.content),
      );
    const batch = tools(1)[0]!;
    expect(batch).toContain("=== book/a.md ===\nAlpha text");
    expect(batch).toContain("=== book/b.md ===\nBravo text");
    expect(batch.match(/Alpha text/g)).toHaveLength(1);
    expect(tools(2)[1]).toMatch(/Already read/);
  });

  it("collects a write into a proposal, and the repository stays untouched", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "write_file",
            args: { path: "quiz/hello.json", content: '{"hello":1}' },
          },
        ],
      },
      { deltas: ["Created."] },
    ];
    const s = script(answers);
    const { owner, book, assist } = await world({}, (asked) => s.next(asked), {
      "book/index.md": "# Physics",
    });
    const res = await owner.c.post(assist, {
      prompt: "Add a quiz",
      pagePath: "book/index.md",
    });
    const seen = events(res.body);
    const proposal = seen.find((e) => e.event === "proposal")!;
    expect(proposal.data.changes).toHaveLength(1);
    const change = proposal.data.changes[0];
    expect(change.op).toBe("write");
    expect(change.path).toBe("quiz/hello.json");
    expect(change.baseOid).toBeNull();
    expect(change.oldText).toBeNull();
    expect(change.diff).toContain('+{"hello":1}');

    // Nothing was written to the book without the teacher's acceptance.
    const listing = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    expect(listing.files.map((f: { path: string }) => f.path)).toEqual([
      "book/index.md",
    ]);
  });

  it("searches all text files with a regex and reports path, line and text", async () => {
    const s = script([
      { toolCalls: [{ name: "search_files", args: { pattern: "TODO" } }] },
      { deltas: ["Found them"] },
    ]);
    const { owner, provider, assist } = await world({}, (asked) => s.next(asked), {
      "book/index.md": "# Physics\nTODO: add quiz",
      "book/glossary.md": "No todos here.",
      "book/todo.md": "TODO and todo",
      "book/image.png": "TODO",
    });
    const res = await owner.c.post(assist, {
      prompt: "find the TODOs",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    const toolMessage = provider.asked[1]!.messages.find((m) => m.role === "tool")!;
    const content = String(toolMessage.content);
    expect(content).toContain("book/index.md:2: TODO: add quiz");
    expect(content).toContain("book/todo.md:1: TODO and todo");
    // Case-sensitive, and binary files are not searched.
    expect(content).not.toContain("book/glossary.md");
    expect(content).not.toContain("book/image.png");
  });

  it("renames a file as one proposal — old deleted, new created — and the repo stays untouched", async () => {
    const s = script([
      {
        toolCalls: [
          { name: "rename_file", args: { path: "book/old.md", newPath: "book/new.md" } },
        ],
      },
      { deltas: ["Renamed"] },
    ]);
    const { owner, book, assist } = await world({}, (asked) => s.next(asked), {
      "book/old.md": "# Old\n\nContent.",
      "book/index.md": "# Physics",
    });
    const res = await owner.c.post(assist, {
      prompt: "rename old.md to new.md",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    const proposal = events(res.body).find((e) => e.event === "proposal")!;
    expect(proposal.data.changes).toHaveLength(2);
    const del = proposal.data.changes.find((c: { op: string }) => c.op === "delete");
    const write = proposal.data.changes.find((c: { op: string }) => c.op === "write");
    expect(del.path).toBe("book/old.md");
    expect(write.path).toBe("book/new.md");
    expect(write.baseOid).toBeNull();
    expect(write.newText).toBe("# Old\n\nContent.");

    // Nothing was renamed in the book without the teacher's acceptance.
    const listing = (await owner.c.get(`/api/books/${book.id}/files`)).body;
    expect(listing.files.map((f: { path: string }) => f.path).sort()).toEqual([
      "book/index.md",
      "book/old.md",
    ]);
  });

  it("refuses to rename onto an existing path", async () => {
    const s = script([
      {
        toolCalls: [
          { name: "rename_file", args: { path: "book/a.md", newPath: "book/b.md" } },
        ],
      },
      { deltas: ["Done"] },
    ]);
    const { owner, provider, assist } = await world({}, (asked) => s.next(asked), {
      "book/a.md": "A",
      "book/b.md": "B",
    });
    const res = await owner.c.post(assist, {
      prompt: "rename a onto b",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    expect(events(res.body).some((e) => e.event === "proposal")).toBe(false);
    const toolMessage = provider.asked[1]!.messages.find((m) => m.role === "tool")!;
    expect(String(toolMessage.content)).toMatch(/already a file/);
  });

  it("answers from the overlay: a written file reads back changed", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "write_file",
            args: { path: "book/notes.md", content: "Fresh" },
          },
          { name: "read_file", args: { path: "book/notes.md" } },
        ],
      },
      { deltas: ["Checked."] },
    ];
    const s = script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      {
        "book/notes.md": "Stale",
      },
    );
    await owner.c.post(assist, {
      prompt: "Rewrite and check",
      pagePath: "book/index.md",
    });
    const toolMessages = provider.asked[1]!.messages.filter(
      (m) => m.role === "tool",
    );
    expect(toolMessages.map((m) => String(m.content)).join("\n")).toContain(
      "Fresh",
    );
  });

  it("falls back to no tools when the provider rejects them", async () => {
    const answers: Answer[] = [{ error: 400 }, { deltas: ["fallback"] }];
    const s = script(answers);
    const { owner, provider, assist } = await world({}, (asked) =>
      s.next(asked),
    );
    const res = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual(["conversation", "delta", "usage", "done"]);
    expect(seen[1]!.data).toEqual({ text: "fallback" });
    // First asked again with the smaller output cap (a provider may reject
    // a big one), then without tools.
    expect(provider.asked).toHaveLength(3);
    expect(provider.asked[0]!).toMatchObject({ maxTokens: 65536 });
    expect(provider.asked[1]!).toMatchObject({ maxTokens: 16384 });
    expect(provider.asked[1]!.tools).toBeDefined();
    expect(provider.asked[2]!.tools).toBeUndefined();
  });

  it("refuses to rewrite a page it only saw as an excerpt", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "write_file",
            args: { path: "book/index.md", content: "Replaced" },
          },
        ],
      },
      { deltas: ["Here is the text instead:"] },
    ];
    const s = script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      {
        "book/index.md": "# Physics\n\nA long page\n",
      },
    );
    // pageText omitted: the assistant must not write the page.
    await owner.c.post(assist, {
      prompt: "Rewrite the page",
      pagePath: "book/index.md",
      context: "# Physics\n\nA long pa…",
    });
    const toolMessage = provider.asked[1]!.messages.find(
      (m) => m.role === "tool",
    )!;
    expect(String(toolMessage.content)).toMatch(/excerpt/i);
  });

  it("proposes an edit of the open page against its unsaved text", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "write_file",
            args: { path: "book/index.md", content: "# Physics, improved" },
          },
        ],
      },
      { deltas: ["Proposed."] },
    ];
    const s = script(answers);
    const { owner, assist } = await world({}, (asked) => s.next(asked), {
      "book/index.md": "# Physics",
    });
    const res = await owner.c.post(assist, {
      prompt: "Improve the whole page",
      pagePath: "book/index.md",
      pageText: "# Physics, unsaved edit",
    });
    const proposal = events(res.body).find((e) => e.event === "proposal")!;
    const change = proposal.data.changes[0];
    expect(change.oldText).toBe("# Physics, unsaved edit");
    expect(change.baseOid).toMatch(/^[0-9a-f]{40}$/);
    expect(change.diff).toContain("-# Physics, unsaved edit");
    expect(change.diff).toContain("+# Physics, improved");
  });

  it("edits passages of a file and of the unsaved open page", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "edit_file",
            args: {
              path: "book/index.md",
              edits: [
                { old_text: "unsaved", new_text: "improved" },
                { old_text: "", new_text: "## Next" },
              ],
            },
          },
          {
            name: "edit_file",
            args: {
              path: "book/notes.md",
              edits: [{ old_text: "B", new_text: "b" }],
            },
          },
        ],
      },
      { deltas: ["Proposed."] },
    ];
    const s = new Script(answers);
    const { owner, assist } = await world({}, (asked) => s.next(asked), {
      "book/index.md": "# Physics",
      "book/notes.md": "A\nB\nC\n",
    });
    const res = await owner.c.post(assist, {
      prompt: "Improve and continue",
      pagePath: "book/index.md",
      pageText: "# Physics, unsaved edit\n",
    });
    const proposal = events(res.body).find((e) => e.event === "proposal")!;
    const byPath = Object.fromEntries(
      proposal.data.changes.map((c: { path: string }) => [c.path, c]),
    );
    expect(byPath["book/index.md"].oldText).toBe("# Physics, unsaved edit\n");
    expect(byPath["book/index.md"].newText).toBe(
      "# Physics, improved edit\n\n## Next\n",
    );
    expect(byPath["book/notes.md"].newText).toBe("A\nb\nC\n");
  });

  it("applies no edit when one passage is missing or ambiguous", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "edit_file",
            args: {
              path: "book/notes.md",
              edits: [
                { old_text: "A", new_text: "a" },
                { old_text: "nowhere", new_text: "x" },
              ],
            },
          },
          {
            name: "edit_file",
            args: {
              path: "book/notes.md",
              edits: [{ old_text: "B", new_text: "b" }],
            },
          },
        ],
      },
      { deltas: ["Could not."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      { "book/notes.md": "A\nB\nB\n" },
    );
    const res = await owner.c.post(assist, {
      prompt: "Edit",
      pagePath: "book/index.md",
    });
    const results = provider.asked[1]!.messages
      .filter((m) => m.role === "tool")
      .map((m) => String(m.content));
    expect(results[0]).toMatch(/Edit 2: old_text is not in book\/notes.md/);
    expect(results[1]).toMatch(/more than once/);
    expect(events(res.body).some((e) => e.event === "proposal")).toBe(false);
  });

  it("names similar paths instead of listing the whole book for a wrong path", async () => {
    const answers = [
      { toolCalls: [{ name: "read_files", args: { paths: ["book/lists.md"] } }] },
      { deltas: ["Found it."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      {
        "book/data/lists.md": "# Lists",
        "book/index.md": "# Physics",
        "public/a.png": "png",
      },
    );
    await owner.c.post(assist, {
      prompt: "Read the lists page",
      pagePath: "book/index.md",
    });
    const result = String(
      provider.asked[1]!.messages.find((m) => m.role === "tool")!.content,
    );
    expect(result).toContain("No file with that path");
    expect(result).toContain("book/data/lists.md");
    expect(result).not.toContain("public/a.png");
  });

  it("records a deletion only for files that exist", async () => {
    const answers = [
      { toolCalls: [{ name: "delete_file", args: { path: "book/ghost.md" } }] },
      { deltas: ["There was nothing to delete."] },
    ];
    const s = script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      {
        "book/index.md": "# Physics",
      },
    );
    const res = await owner.c.post(assist, {
      prompt: "Delete the ghost page",
      pagePath: "book/index.md",
    });
    const toolMessage = provider.asked[1]!.messages.find(
      (m) => m.role === "tool",
    )!;
    expect(String(toolMessage.content)).toMatch(/No file with that path/);
    // No proposal for a failed deletion.
    expect(events(res.body).some((e) => e.event === "proposal")).toBe(false);
  });
});

describe("AI agent: long work", () => {
  it("tells the last step to wrap up, and ends with finish: steps when work is left", async () => {
    const { owner, provider, assist } = await world(
      { AI_MAX_STEPS: "2" },
      () => ({ toolCalls: [{ name: "list_files", args: {} }] }),
    );
    const res = await owner.c.post(assist, { prompt: "Reorganize the book", pagePath: "book/index.md" });
    const seen = events(res.body);
    expect(provider.asked).toHaveLength(2);
    expect(String(provider.asked[1]!.messages.at(-1)!.content)).toMatch(/last step/);
    // The wrap-up note is not kept in the history of later steps.
    expect(String(provider.asked[0]!.messages.at(-1)!.content)).not.toMatch(/last step/);
    expect(seen.at(-1)).toMatchObject({ event: "done", data: { finish: "steps" } });
  });

  it("does not run a tool call the cap cut off, and asks for smaller calls", async () => {
    const answers: Answer[] = [
      { toolCalls: [{ name: "write_file", args: { path: "book/a.md", content: "half" } }], finish: "length" },
      { toolCalls: [{ name: "write_file", args: { path: "book/a.md", content: "# A\n" } }] },
      { deltas: ["Wrote it."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist } = await world({}, (asked) => s.next(asked));
    const res = await owner.c.post(assist, { prompt: "Write page A", pagePath: "book/index.md" });
    const seen = events(res.body);
    expect(String(provider.asked[1]!.messages.at(-1)!.content)).toMatch(/write_file call was cut off/);
    // Only the complete call ran.
    expect(seen.filter((e) => e.event === "tool")).toHaveLength(1);
    const proposal = seen.find((e) => e.event === "proposal")!.data.changes;
    expect(proposal).toEqual([expect.objectContaining({ path: "book/a.md", newText: "# A\n" })]);
  });

  it("builds on a proposal the teacher has not decided on, until they do", async () => {
    const answers: Answer[] = [
      { toolCalls: [{ name: "write_file", args: { path: "book/quiz.md", content: "# Quiz\n" } }] },
      { deltas: ["Proposed a quiz."] },
      { toolCalls: [{ name: "read_files", args: { paths: ["book/quiz.md"] } }] },
      { toolCalls: [{ name: "write_file", args: { path: "book/more.md", content: "# More\n" } }] },
      { deltas: ["Added more."] },
      { deltas: ["Nothing pending."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist, book } = await world({}, (asked) => s.next(asked));
    const first = await owner.c.post(assist, { prompt: "Make a quiz", pagePath: "book/index.md" });
    const { id } = events(first.body)[0]!.data;
    const second = await owner.c.post(assist, {
      prompt: "And another page",
      pagePath: "book/index.md",
      conversationId: id,
    });
    const seen = events(second.body);
    // The model is told what is pending, and reads the pending text back.
    expect(String(provider.asked[2]!.messages.at(-1)!.content)).toMatch(/book\/quiz\.md \(new\)/);
    const read = provider.asked[3]!.messages.find((m) => m.role === "tool")!;
    expect(String(read.content)).toContain("# Quiz");
    // The new proposal holds both pages; the first one is superseded.
    const changes = seen.find((e) => e.event === "proposal")!.data.changes;
    expect(changes.map((c: { path: string }) => c.path).sort()).toEqual(["book/more.md", "book/quiz.md"]);
    const loaded = await owner.c.get(`/api/books/${book.id}/ai/conversations/${id}`);
    const answersOf = loaded.body.messages.filter((m: { role: string }) => m.role === "assistant");
    expect(answersOf.map((m: { proposalStatus: string }) => m.proposalStatus)).toEqual(["superseded", "pending"]);

    // Denied: the next request starts from the repository again.
    const decided = await owner.c.post(
      `/api/books/${book.id}/ai/conversations/${id}/messages/${answersOf[1].id}/proposal`,
      { status: "denied" },
    );
    expect(decided.status).toBe(200);
    const third = await owner.c.post(assist, {
      prompt: "Anything pending?",
      pagePath: "book/index.md",
      conversationId: id,
    });
    expect(events(third.body).some((e) => e.event === "proposal")).toBe(false);
    expect(String(provider.asked.at(-1)!.messages.at(-1)!.content)).not.toMatch(/still waiting/);
  });
});

describe("AI hardening", () => {
  it("rejects an oversized request body before parsing it (413)", async () => {
    const { owner, assist } = await world();
    const res = await owner.c.post(assist, {
      prompt: "x".repeat(21 * 1024 * 1024),
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(413);
  });

  it("refuses external books like the files routes do (409)", async () => {
    const { owner, book, assist } = await world();
    const res = await owner.c.patch(`/api/books/${book.id}`, {
      externalUrl: "https://example.org/book",
    });
    expect(res.status).toBe(200);
    const denied = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    expect(denied.status).toBe(409);
    expect(denied.body.error).toMatch(/hosted elsewhere/i);
  });

  it("does not retry without tools when the provider answers 401", async () => {
    const { owner, provider, assist } = await world({}, () => ({ error: 401 }));
    const res = await owner.c.post(assist, {
      prompt: "Continue the page",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200); // the stream started; the failure is an event
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual(["conversation", "error", "saved"]);
    expect(seen[1]!.data.code).toBe("status");
    // No second, doomed call.
    expect(provider.asked).toHaveLength(1);
  });

  it("refuses to propose a write to a committed file too large to diff", async () => {
    const answers = [
      {
        toolCalls: [
          {
            name: "write_file",
            args: { path: "book/big.md", content: "small" },
          },
        ],
      },
      { deltas: ["Too big to propose."] },
    ];
    const s = new Script(answers);
    const { owner, provider, assist } = await world(
      {},
      (asked) => s.next(asked),
      { "book/big.md": "x".repeat(200_000) },
    );
    const res = await owner.c.post(assist, {
      prompt: "Shrink it",
      pagePath: "book/index.md",
    });
    expect(events(res.body).some((e) => e.event === "proposal")).toBe(false);
    const toolMessage = provider.asked[1]!.messages.find(
      (m) => m.role === "tool",
    )!;
    expect(String(toolMessage.content)).toMatch(/too large/);
  });

  it("diffs a repeated write against the committed text, not the previous write", async () => {
    const answers = [
      {
        toolCalls: [
          { name: "write_file", args: { path: "book/notes.md", content: "B" } },
          { name: "write_file", args: { path: "book/notes.md", content: "C" } },
        ],
      },
      { deltas: ["Done."] },
    ];
    const s = new Script(answers);
    const { owner, assist } = await world({}, (asked) => s.next(asked), {
      "book/notes.md": "A\n",
    });
    const res = await owner.c.post(assist, {
      prompt: "Rewrite twice",
      pagePath: "book/index.md",
    });
    const proposal = events(res.body).find((e) => e.event === "proposal")!;
    const change = proposal.data.changes[0];
    expect(change.newText).toBe("C");
    expect(change.oldText).toBe("A\n");
    expect(change.diff).toContain("-A");
    expect(change.diff).toContain("+C");
    expect(change.diff).not.toContain("-B");
  });

  it("ships no bytes when a large or binary file is deleted", async () => {
    const answers = [
      {
        toolCalls: [{ name: "delete_file", args: { path: "public/big.bin" } }],
      },
      { deltas: ["Deleted."] },
    ];
    const s = new Script(answers);
    const { owner, assist } = await world({}, (asked) => s.next(asked), {
      "public/big.bin": "x".repeat(200_000),
      "book/index.md": "# Physics",
    });
    const res = await owner.c.post(assist, {
      prompt: "Remove the big file",
      pagePath: "book/index.md",
    });
    const proposal = events(res.body).find((e) => e.event === "proposal")!;
    const change = proposal.data.changes[0];
    expect(change.op).toBe("delete");
    expect(change.oldText).toBe("");
    expect(change.diff).toMatch(/deleted/);
    expect(change.diff.length).toBeLessThan(200);
  });
});

describe("AI version note", () => {
  it("suggests a note from the changes since the live version and counts it", async () => {
    const { owner, provider, book } = await world(
      {},
      () => ({ deltas: ['"New chapter', ' on lenses."\n', "And more."] }),
      { "hyperbook.json": '{"name":"Physics"}', "book/lenses.md": "# Lenses\n\nThey bend light.\n" },
    );
    const res = await owner.c.post(`/api/books/${book.id}/ai/version-note`, {});
    expect(res.status).toBe(200);
    // Only the first line, without the quotes and the period.
    expect(res.body).toEqual({ note: "New chapter on lenses" });

    // The model saw the diff, without tools, in the teacher's language.
    expect(provider.asked).toHaveLength(1);
    const [asked] = provider.asked;
    expect(asked!.tools).toBeUndefined();
    expect(String(asked!.messages[0]!.content)).toMatch(/Write it in English/);
    expect(String(asked!.messages[1]!.content)).toContain("book/lenses.md");
    expect(String(asked!.messages[1]!.content)).toContain("+They bend light.");

    // A request like the assistant's, and its tokens.
    const status = (await owner.c.get("/api/ai")).body;
    expect(status.usedToday).toBe(1);
    expect(status.tokensUsedThisWeek).toBeGreaterThan(0);
  });

  it("is for the owners, who publish", async () => {
    const { owner, other, book } = await world({}, undefined, { "hyperbook.json": "{}" });
    await owner.c.post(`/api/books/${book.id}/members`, { email: "x@example.org", role: "editor" });
    expect((await other.c.post(`/api/books/${book.id}/ai/version-note`, {})).status).toBe(403);
  });

  it("needs a save to describe", async () => {
    const { owner, provider, book } = await world();
    expect((await owner.c.post(`/api/books/${book.id}/ai/version-note`, {})).status).toBe(409);
    expect(provider.asked).toHaveLength(0);
  });

  it("answers 503 when AI is off", async () => {
    const instance = setup();
    const owner = await loggedIn(instance, { email: "o@example.org" });
    const book = (await owner.c.post("/api/books", { title: "P", slug: "p" })).body;
    expect((await owner.c.post(`/api/books/${book.id}/ai/version-note`, {})).status).toBe(503);
  });
});
