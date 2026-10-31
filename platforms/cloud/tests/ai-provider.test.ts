import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderError, streamChat } from "../src/server/ai/provider";

/*
 * streamChat against stub providers: SSE streams with CRLF line endings (the
 * spec allows \n, \r\n and \r), a last event without a trailing blank line,
 * an unreachable provider, and a caller abort — which must travel as an
 * abort, not as "the provider could not be reached".
 */

type Stub = { url: string; lastBody?: unknown; close: () => Promise<void> };
const stubs: Stub[] = [];
afterEach(async () => {
  for (const stub of stubs.splice(0)) await stub.close();
});

/** A chat-completions endpoint answering with the given raw SSE chunks. */
function stubChunks(chunks: string[], crlf = false): Stub {
  const nl = crlf ? "\r\n" : "\n";
  const stub: Stub = {
    url: "",
    lastBody: undefined,
    close: () => Promise.reject(new Error("not listening yet")),
  };
  const app = new Hono();
  app.post("/v1/chat/completions", async (c) => {
    stub.lastBody = await c.req.json();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks)
          controller.enqueue(
            new TextEncoder().encode(chunk.split("\n").join(nl)),
          );
        controller.close();
      },
    });
    return new Response(body, {
      headers: { "content-type": "text/event-stream" },
    });
  });
  const server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  stub.url =
    typeof address === "object" && address
      ? `http://localhost:${address.port}/v1`
      : "";
  stub.close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  stubs.push(stub);
  return stub;
}

async function collect(stub: Stub, signal?: AbortSignal): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of streamChat({
    baseUrl: stub.url,
    apiKey: "key",
    model: "m",
    messages: [{ role: "user", content: "hi" }],
    maxOutputTokens: 64,
    timeoutMs: 10_000,
    signal,
  })) {
    events.push(event);
  }
  return events;
}

const TEXT_STREAM = [
  'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
  "data: [DONE]\n\n",
];

const TOOL_STREAM = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_file","arguments":"{\\"path\\":"}}]}}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"book/index.md\\"}"}}]}}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
  "data: [DONE]\n\n",
];

describe("streamChat", () => {
  it("sends prompt_cache_key when a cache key is given, and omits it otherwise", async () => {
    const keyed = stubChunks(TEXT_STREAM);
    for await (const event of streamChat({
      baseUrl: keyed.url,
      apiKey: "key",
      model: "m",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 64,
      timeoutMs: 10_000,
      cacheKey: "hyperbook:abc123",
    })) {
      void event;
    }
    expect((keyed.lastBody as { prompt_cache_key?: string }).prompt_cache_key).toBe(
      "hyperbook:abc123",
    );

    const plain = stubChunks(TEXT_STREAM);
    await collect(plain);
    expect(
      (plain.lastBody as { prompt_cache_key?: string }).prompt_cache_key,
    ).toBeUndefined();
  });

  it("parses LF-separated deltas and the finish", async () => {
    const stub = stubChunks(TEXT_STREAM);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Hello" },
      { type: "delta", text: " world" },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("parses CRLF line endings, deltas and tool calls alike", async () => {
    const stub = stubChunks(TEXT_STREAM, true);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Hello" },
      { type: "delta", text: " world" },
      { type: "finish", finish: "stop" },
    ]);

    const tools = stubChunks(TOOL_STREAM, true);
    expect(await collect(tools)).toEqual([
      {
        type: "tool_calls",
        calls: [
          { id: "c1", name: "read_file", args: '{"path":"book/index.md"}' },
        ],
      },
      { type: "finish", finish: "tool_calls" },
    ]);
  });

  it("parses deltas whose content is an array of parts, ignoring the rest", async () => {
    // z.ai's GLM sends content as [{type:"text",text:"…"}] parts, and may
    // add reasoning_content; only the text parts are the answer.
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Hello"}]}}]}\n\n',
      'data: {"choices":[{"delta":{"content":[{"type":"text","text":" "},{"type":"reasoning","reasoning":"hmm"},{"type":"text","text":"world"}]}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Hello" },
      { type: "delta", text: " world" },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("parses a delta whose content is a single part object, not a list", async () => {
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"content":{"type":"text","text":"Hi"}}}]}\n\n',
      'data: {"choices":[{"delta":{"content":{"type":"text","text":" there"}}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Hi" },
      { type: "delta", text: " there" },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("counts a last event that arrives without a trailing blank line", async () => {
    // No final \n\n and no [DONE]: the stream simply ends after one delta.
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"content":"x"}}]}\n',
    ]);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "x" },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("falls back to reasoning_content when content stays empty (GLM reasoning models)", async () => {
    // z.ai's GLM-5.x can put the whole visible answer into reasoning_content
    // and leave content "" — that must not surface as an "empty" error.
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"reasoning_content":"Let me think… "}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"the answer."}}]}\n\n',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Let me think… the answer." },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("reports usage with the cached prompt tokens Mistral puts in prompt_tokens_details", async () => {
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":20,"prompt_tokens_details":{"cached_tokens":40}}}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(await collect(stub)).toEqual([
      { type: "delta", text: "Hi" },
      { type: "usage", promptTokens: 100, cachedPromptTokens: 40, completionTokens: 20 },
      { type: "finish", finish: "stop" },
    ]);
  });

  it("accepts a top-level cached-token field and defaults it to 0", async () => {
    const stub = stubChunks([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":20,"prompt_tokens_cached":40}}\n\n',
      "data: [DONE]\n\n",
    ]);
    const events = await collect(stub);
    expect(events[1]).toEqual({
      type: "usage",
      promptTokens: 100,
      cachedPromptTokens: 40,
      completionTokens: 20,
    });

    const plain = stubChunks([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":20}}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect((await collect(plain))[1]).toEqual({
      type: "usage",
      promptTokens: 100,
      cachedPromptTokens: 0,
      completionTokens: 20,
    });
  });

  it("rejects a successful stream with no text or tool calls", async () => {
    const stub = stubChunks([]);
    await expect(collect(stub)).rejects.toMatchObject({ code: "empty" });
  });

  it("reports an unreachable provider as such", async () => {
    const stub = stubChunks([]);
    const url = stub.url;
    await stub.close(); // nothing listens there anymore
    stubs.pop();
    await expect(
      collect({ url, close: async () => {} }),
    ).rejects.toBeInstanceOf(ProviderError);
    await expect(collect({ url, close: async () => {} })).rejects.toMatchObject(
      {
        code: "unreachable",
      },
    );
  });

  it("lets a caller abort through instead of calling it unreachable", async () => {
    const app = new Hono();
    app.post("/v1/chat/completions", () => {
      // One delta, then the stream stays open until the caller aborts.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"x"}}]}\n\n',
            ),
          );
        },
      });
      return new Response(body, {
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
    stubs.push({ url, close });

    const controller = new AbortController();
    const events: unknown[] = [];
    const gen = streamChat({
      baseUrl: url,
      apiKey: "key",
      model: "m",
      messages: [],
      maxOutputTokens: 64,
      timeoutMs: 60_000,
      signal: controller.signal,
    });
    events.push((await gen.next()).value);
    expect(events[0]).toEqual({ type: "delta", text: "x" });
    controller.abort();
    // An abort is an AbortError, not a ProviderError — the route tells a
    // stopped request apart from a failing provider this way.
    const error = await gen.next().catch((e: unknown) => e);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(error).not.toBeInstanceOf(ProviderError);
  });
});
