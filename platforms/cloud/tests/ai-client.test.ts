import { afterEach, describe, expect, it } from "vitest";
import { assist } from "../src/web/lib/ai";

/*
 * The streaming client's SSE parsing: the same wire format the route sends
 * (platforms/cloud/docs/cloud-ai-assistant.md), answered by a stubbed fetch. Only the
 * parsing is tested here; the route has its own tests against a fake
 * provider, and the panel's flow is covered by an e2e run.
 */

const encoder = new TextEncoder();

function sseResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

const fetches: { url: string; body: unknown }[] = [];
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(response: () => Response) {
  fetches.length = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    fetches.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return response();
  }) as typeof fetch;
}

describe("assist", () => {
  it("reads the stream's events in order", async () => {
    stubFetch(() =>
      sseResponse([
        'event: delta\ndata: {"text":"Hello"}\n\nevent: delta\ndata: {"text":" world"}\n\n',
        'event: done\ndata: {"finish":"stop"}\n\n',
      ]),
    );
    const seen: unknown[] = [];
    await assist(
      1,
      { action: "continue", pagePath: "book/index.md" },
      (event) => seen.push(event),
      new AbortController().signal,
    );
    expect(seen).toEqual([
      { event: "delta", text: "Hello" },
      { event: "delta", text: " world" },
      { event: "done", finish: "stop" },
    ]);
    // The request carries the input as JSON to the right route.
    expect(fetches[0]!.url).toBe("/api/books/1/ai/assist");
    expect(fetches[0]!.body).toEqual({
      action: "continue",
      pagePath: "book/index.md",
    });
  });

  it("maps later events, and tolerates a chunk split across reads", async () => {
    // One event arrives in two pieces, as real streams do.
    stubFetch(() =>
      sseResponse([
        'event: delta\ndata: {"text":"partial"}\n\nevent: to',
        'ol\ndata: {"name":"read_file"}\n\nevent: done\ndata: {"finish":"length"}\n\n',
      ]),
    );
    const seen: unknown[] = [];
    await assist(
      1,
      { action: "free", prompt: "hi", pagePath: "book/index.md" },
      (event) => seen.push(event),
      new AbortController().signal,
    );
    expect(seen).toEqual([
      { event: "delta", text: "partial" },
      { event: "tool", name: "read_file", args: {} },
      { event: "done", finish: "length" },
    ]);
  });

  it("parses CRLF line endings, which the SSE spec allows", async () => {
    stubFetch(() =>
      sseResponse([
        'event: delta\r\ndata: {"text":"Hello"}\r\n\r\nevent: done\r\ndata: {"finish":"stop"}\r\n\r\n',
      ]),
    );
    const seen: unknown[] = [];
    await assist(
      1,
      { action: "continue", pagePath: "book/index.md" },
      (event) => seen.push(event),
      new AbortController().signal,
    );
    expect(seen).toEqual([
      { event: "delta", text: "Hello" },
      { event: "done", finish: "stop" },
    ]);
  });

  it("parses the answer's usage from the done event", async () => {
    stubFetch(() =>
      sseResponse([
        'event: delta\ndata: {"text":"Hello"}\n\n',
        'event: done\ndata: {"finish":"stop","usage":{"tokensIn":100,"tokensCached":40,"tokensOut":20,"credits":120}}\n\n',
      ]),
    );
    const seen: unknown[] = [];
    await assist(
      1,
      { action: "continue", pagePath: "book/index.md" },
      (event) => seen.push(event),
      new AbortController().signal,
    );
    expect(seen).toEqual([
      { event: "delta", text: "Hello" },
      {
        event: "done",
        finish: "stop",
        usage: { tokensIn: 100, tokensCached: 40, tokensOut: 20, credits: 120 },
      },
    ]);
  });

  it("counts a last event that arrives without a trailing blank line", async () => {
    stubFetch(() => sseResponse(['event: delta\ndata: {"text":"tail"}\n']));
    const seen: unknown[] = [];
    await assist(
      1,
      { action: "continue", pagePath: "book/index.md" },
      (event) => seen.push(event),
      new AbortController().signal,
    );
    expect(seen).toEqual([{ event: "delta", text: "tail" }]);
  });

  it("reports the route's translated errors", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ error: "Too many AI requests right now." }),
          {
            status: 429,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    await expect(
      assist(
        1,
        { action: "continue", pagePath: "book/index.md" },
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow(/Too many AI requests/);
  });
});
