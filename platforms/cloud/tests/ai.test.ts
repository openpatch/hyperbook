import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { auditLog } from "../src/server/db/schema";
import { clearDocumentationCache } from "../src/server/ai/docs";
import { loggedIn, setup } from "./helpers";

/*
 * A fake OpenAI-compatible provider: a chat-completions endpoint on an
 * ephemeral port that streams scripted deltas and records what it was
 * asked. The real providers all speak this protocol (docs/cloud-ai-assistant.md).
 */

type Asked = {
  model: string;
  messages: { role: string; content: unknown }[];
  maxTokens: number;
  tools?: unknown;
};

type Answer =
  | { deltas: string[]; finish?: "stop" | "length" }
  | { toolCalls: { name: string; args: unknown }[] }
  | { error: number };

/** A queue of answers, one per provider call; the last repeats. */
class Script {
  constructor(readonly answers: Answer[]) {}
  private index = 0;
  next(asked: Asked): Answer {
    // A provider that rejects tools outright, like a small local model.
    if ("error" in this.peek()) {
      const answer = this.peek() as { error: number };
      if (asked.tools !== undefined && answer.error === 400) {
        this.index = Math.min(this.index + 1, this.answers.length - 1);
        return { error: 400 };
      }
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
    };
    asked.push(request);
    const answer = script(request);
    if ("error" in answer) return c.json({ error: "no" }, answer.error as 500);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if ("toolCalls" in answer) {
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
            choices: [{ delta: {}, finish_reason: "tool_calls" }],
          });
          // Providers that honour include_usage end with a usage chunk.
          const usage = JSON.stringify({
            choices: [],
            usage: { prompt_tokens: 100, completion_tokens: 20 },
          });
          controller.enqueue(
            encoder.encode(`data: ${done}\n\ndata: ${usage}\n\ndata: [DONE]\n\n`),
          );
        } else {
          for (const text of answer.deltas) {
            const chunk = JSON.stringify({
              choices: [{ delta: { content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
          const done = JSON.stringify({
            choices: [{ delta: {}, finish_reason: answer.finish ?? "stop" }],
          });
          // Providers that honour include_usage end with a usage chunk.
          const usage = JSON.stringify({
            choices: [],
            usage: { prompt_tokens: 100, completion_tokens: 20 },
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
      modelWeights: { "mistral-test": 1 },
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
      action: "free",
      prompt: "Say hi",
      pagePath: "book/index.md",
      context: "# Physics\n\nWelcome.",
    });
    expect(res.status).toBe(200);
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual([
      "delta",
      "delta",
      "delta",
      "usage",
      "done",
    ]);
    expect(seen[0]!.data).toEqual({ text: "Hello" });
    expect(seen[4]!.data).toEqual({ finish: "stop" });

    // The provider saw the key and the model, and a message pair that
    // knows the book: system prompt, hyperbook conventions, the page.
    expect(provider.asked).toHaveLength(1);
    const [asked] = provider.asked;
    expect(asked!.model).toBe("mistral-test");
    expect(asked!.maxTokens).toBe(2048);
    expect(asked!.messages).toHaveLength(2);
    expect(asked!.messages[0]!.role).toBe("system");
    expect(String(asked!.messages[0]!.content)).toMatch(/hyperbook/i);
    expect(String(asked!.messages[0]!.content)).toMatch(/Language: en/);
    expect(String(asked!.messages[1]!.content)).toContain("book/index.md");
    expect(String(asked!.messages[1]!.content)).toContain("# Physics");
    expect(String(asked!.messages[1]!.content)).toContain("Say hi");
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
        action: "free",
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
      action: "free",
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
      action: "improve",
      pagePath: "book/lists.md",
      selection: "A linked list is …",
    });
    expect(res.status).toBe(200);
    const user = provider.asked[0]!.messages[1]!;
    expect(String(user.content)).toContain("A linked list is …");
    expect(String(user.content)).toMatch(/improve the selected passage/i);
  });

  it("answers 503 when AI is off", async () => {
    const instance = setup();
    const owner = await loggedIn(instance, { email: "o@example.org" });
    const book = (await owner.c.post("/api/books", { title: "P", slug: "p" }))
      .body;
    const res = await owner.c.post(`/api/books/${book.id}/ai/assist`, {
      action: "continue",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("hides books the teacher does not edit", async () => {
    const { other, assist } = await world();
    const res = await other.c.post(assist, {
      action: "continue",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(404);
  });

  it("rejects a free request without a prompt, and bad paths", async () => {
    const { owner, assist } = await world();
    const noPrompt = await owner.c.post(assist, {
      action: "free",
      pagePath: "book/index.md",
    });
    expect(noPrompt.status).toBe(400);
    expect(noPrompt.body.issues[0].path).toBe("prompt");
    const badPath = await owner.c.post(assist, {
      action: "continue",
      pagePath: "../outside.md",
    });
    expect(badPath.status).toBe(400);
  });

  it("rate limits per teacher", async () => {
    const { owner, other, assist } = await world({
      AI_REQUESTS_PER_MINUTE: "2",
    });
    const body = { action: "continue", pagePath: "book/index.md" };
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
      action: "continue",
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
          action: "continue",
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
    const body = { action: "continue", pagePath: "book/index.md" };

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
    const { owner, instance, assist } = await world({
      AI_MODELS: "mistral-big",
      AI_MODEL_WEIGHTS: "mistral-big=3",
    });
    const admin = await loggedIn(instance, {
      email: "admin@example.org",
      role: "admin",
    });
    await admin.c.put(`/api/users/${owner.user.id}/entitlements`, {
      ai_tokens_per_week: 500,
    });
    const body = {
      action: "continue",
      pagePath: "book/index.md",
      model: "mistral-big",
    };
    // 120 tokens (100 in, 20 out) at weight 3 = 360 credits.
    const res = await owner.c.post(assist, body);
    expect(events(res.body).find((e) => e.event === "usage")!.data).toEqual({
      tokensUsedThisWeek: 360,
      tokenQuota: 500,
    });
    expect((await owner.c.get("/api/ai")).body).toMatchObject({
      modelWeights: { "mistral-test": 1, "mistral-big": 3 },
      tokensUsedThisWeek: 360,
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
    // Until something is saved, the environment's models show.
    expect((await admin.c.get("/api/instance")).body.ai).toEqual({
      configured: true,
      defaultModel: "mistral-test",
      models: [
        { id: "mistral-test", weight: 1, label: "" },
        { id: "mistral-big", weight: 1, label: "" },
      ],
    });

    const bad = await admin.c.put("/api/instance", {
      aiModels: [{ id: "a", weight: 1 }],
      aiDefaultModel: "b",
    });
    expect(bad.status).toBe(400);

    const ok = await admin.c.put("/api/instance", {
      aiModels: [
        { id: "mistral-large-4", weight: 1 },
        { id: "zai-glm-5-3-flash", weight: 0.22 },
      ],
      aiDefaultModel: "zai-glm-5-3-flash",
    });
    expect(ok.status).toBe(200);
    expect(await owner.c.get("/api/ai")).toMatchObject({
      body: {
        model: "zai-glm-5-3-flash",
        models: ["zai-glm-5-3-flash", "mistral-large-4"],
        modelWeights: { "mistral-large-4": 1, "zai-glm-5-3-flash": 0.22 },
      },
    });
  });

  it("shows an admin's alias for a model and monitors the usage", async () => {
    const { owner, other, instance, assist } = await world();
    const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
    expect(
      (
        await admin.c.put("/api/instance", {
          aiModels: [{ id: "mistral-test", weight: 1, label: "Fast" }],
        })
      ).status,
    ).toBe(200);
    expect((await owner.c.get("/api/ai")).body.modelLabels).toEqual({ "mistral-test": "Fast" });
    expect((await admin.c.get("/api/instance")).body.ai.models).toEqual([
      { id: "mistral-test", weight: 1, label: "Fast" },
    ]);

    await owner.c.post(assist, { action: "free", prompt: "hi", pagePath: "book/index.md" });
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
    const body = { action: "continue", pagePath: "book/index.md" };
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
      action: "free",
      prompt: "hi",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200); // The stream started; the failure is an event.
    const seen = events(res.body);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.event).toBe("error");
    expect(seen[0]!.data.code).toBe("status");
    expect(seen[0]!.data.message).toMatch(/did not answer/i);

    const entries = instance.db
      .select()
      .from(auditLog)
      .all()
      .filter((e) => e.action === "ai.assist");
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.action).toBe("ai.assist");
    expect(entry.data as Record<string, unknown>).toMatchObject({
      action: "free",
      page: "book/index.md",
      model: "mistral-test",
      finish: "error",
    });
  });

  it("audits a successful request without its content", async () => {
    const { owner, instance, assist } = await world();
    await owner.c.post(assist, {
      action: "continue",
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
      action: "continue",
      page: "book/index.md",
      finish: "stop",
    });
    expect(JSON.stringify(data)).not.toContain("secret page text");
  });

  it("streams the token cap as finish: length", async () => {
    const { owner, assist } = await world({}, () => ({
      deltas: ["partial"],
      finish: "length",
    }));
    const res = await owner.c.post(assist, {
      action: "continue",
      pagePath: "book/index.md",
    });
    const seen = events(res.body);
    expect(seen.at(-1)).toEqual({ event: "done", data: { finish: "length" } });
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
    await owner.c.post(assist, { action: "free", prompt: "read all", pagePath: "book/index.md" });
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
      action: "free",
      prompt: "What is the first heading?",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200);
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual(["usage", "tool", "delta", "usage", "done"]);
    expect(seen[1]!.data).toEqual({
      name: "read_file",
      args: { path: "book/index.md" },
    });

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
      action: "free",
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
      action: "free",
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
      action: "free",
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
      action: "continue",
      pagePath: "book/index.md",
    });
    const seen = events(res.body);
    expect(seen.map((e) => e.event)).toEqual(["delta", "usage", "done"]);
    expect(seen[0]!.data).toEqual({ text: "fallback" });
    // The retry asked without tools.
    expect(provider.asked).toHaveLength(2);
    expect(provider.asked[0]!.tools).toBeDefined();
    expect(provider.asked[1]!.tools).toBeUndefined();
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
      action: "free",
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
      action: "free",
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
      action: "free",
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

describe("AI hardening", () => {
  it("rejects an oversized request body before parsing it (413)", async () => {
    const { owner, assist } = await world();
    const res = await owner.c.post(assist, {
      action: "free",
      prompt: "x".repeat(700_000),
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
      action: "continue",
      pagePath: "book/index.md",
    });
    expect(denied.status).toBe(409);
    expect(denied.body.error).toMatch(/hosted elsewhere/i);
  });

  it("does not retry without tools when the provider answers 401", async () => {
    const { owner, provider, assist } = await world({}, () => ({ error: 401 }));
    const res = await owner.c.post(assist, {
      action: "continue",
      pagePath: "book/index.md",
    });
    expect(res.status).toBe(200); // the stream started; the failure is an event
    const seen = events(res.body);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.event).toBe("error");
    expect(seen[0]!.data.code).toBe("status");
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
      action: "free",
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
      action: "free",
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
      action: "free",
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
