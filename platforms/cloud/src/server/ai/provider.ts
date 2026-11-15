/*
 * A client for the OpenAI chat-completions protocol — the one API the
 * assistant needs, because every provider speaks it: Mistral, OpenAI,
 * Anthropic through its compatibility layer, OpenRouter, and a local
 * Ollama or vLLM. See platforms/cloud/docs/cloud-ai-assistant.md.
 */

/** One message of the conversation, in the provider's terms. */
export type ChatMessage =
  | { role: "system"; content: string }
  /** A teacher's turn; with images, a list of parts (OpenAI's vision format). */
  | { role: "user"; content: string | UserContentPart[] }
  /** An assistant turn that asked for tools; `content` is null then. */
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

/** One part of a user message: text, or an image as a data URL. */
export type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** A tool the model may call, in the provider's wire format. */
export type ToolDefinition = {
  name: string;
  description: string;
  /** A JSON Schema object, e.g. `{ type: "object", properties: { … } }`. */
  parameters: Record<string, unknown>;
};

/** A tool call the model made: raw arguments, as it wrote them. */
export type ProviderToolCall = { id: string; name: string; args: string };

/** The provider failed. `code` tells the editor what to tell the teacher. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "unreachable" | "status" | "empty" | "timeout",
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** What one provider call yields while it runs. */
export type ProviderEvent =
  | { type: "delta"; text: string }
  /** The model's thinking, as it streams (reasoning models only). */
  | { type: "reasoning"; text: string }
  /**
   * A tool call while its arguments stream in: which tool, the path once
   * it is known, and how many characters arrived — a long write_file takes
   * minutes and shows nothing else.
   */
  | {
      type: "tool_progress";
      index: number;
      name: string;
      path: string | null;
      chars: number;
    }
  | { type: "tool_calls"; calls: ProviderToolCall[] }
  | {
      type: "usage";
      promptTokens: number;
      /** Prompt tokens served from the prefix cache; 0 when unreported. */
      cachedPromptTokens: number;
      completionTokens: number;
    }
  | { type: "finish"; finish: "stop" | "length" | "tool_calls" };

/**
 * The text of a delta's content. OpenAI sends a plain string; some
 * OpenAI-compatible providers (z.ai's GLM via certain relays, for one)
 * send content parts instead — a single part or a list of them, each with
 * a `text` (or `content`) string. Take the text of those, ignore the rest
 * (reasoning parts, images, …).
 */
function deltaText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(deltaText).join("");
  if (content && typeof content === "object") {
    const part = content as { text?: unknown; content?: unknown };
    if (typeof part.text === "string") return part.text;
    if (typeof part.content === "string") return part.content;
  }
  return "";
}

/**
 * The thinking text of one streamed delta. Mistral's reasoning models
 * (Large 4, Medium 3.5, Small 4) think inside `content` — chunks of
 * { type: "thinking", thinking: [{ type: "text", text }] } — not in a
 * reasoning field, and their thinking counts against max_tokens.
 */
function thinkingText(content: unknown): string {
  let text = "";
  for (const chunk of Array.isArray(content) ? content : [content]) {
    const thinking = (chunk as { thinking?: unknown } | null)?.thinking;
    if (!Array.isArray(thinking)) continue;
    for (const part of thinking) {
      const partText = (part as { text?: unknown } | null)?.text;
      if (typeof partText === "string") text += partText;
    }
  }
  return text;
}

/** Everything the provider call needs. */
type StreamOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
  /** OpenAI-style tool definitions; omitted: a plain text answer. */
  tools?: ToolDefinition[];
  /**
   * A key for providers with prompt caching (Mistral's `prompt_cache_key`):
   * requests that share a prompt prefix carry the same key, and the cached
   * prefix bills at a fraction of the input price (10% on Mistral). The key
   * only raises the chance of a hit; it does not guarantee one. Omitted: no
   * key is sent, for providers that reject unknown fields.
   */
  cacheKey?: string;
  /**
   * How hard a reasoning model thinks (`reasoning_effort`, OpenAI's and
   * Mistral's spelling). Omitted: not sent, the model's default applies.
   */
  reasoningEffort?: "low" | "medium" | "high";
  signal?: AbortSignal;
};

/**
 * A failure while the answer was on its way: the timeout signal firing
 * (again, not the teacher stopping the request — the callers check that
 * first) reads as `timeout`; anything else is a connection cut short.
 * Both must arrive as ProviderErrors the editor can phrase, so a flaky
 * line does not surface as an internal error.
 */
function cutOff(error: unknown, deadline: AbortSignal): ProviderError {
  if (
    (error as { name?: string } | null)?.name === "TimeoutError" ||
    error === deadline.reason
  )
    return new ProviderError("The AI provider timed out", "timeout");
  return new ProviderError(
    "The AI provider could not be reached",
    "unreachable",
  );
}

/**
 * Calls `{baseUrl}/chat/completions` with `stream: true` and yields what
 * happens: the assistant's text as it arrives, the tool calls it made once
 * complete, then how the call ended. `signal` (a disconnecting reader)
 * aborts the provider call; the timeout is an idle one — it fires when the
 * provider sends nothing for that long, before the first byte or mid-stream.
 *
 * A transient failure while nothing was streamed yet — the provider
 * unreachable, a 429, a 5xx — is retried twice with a short pause; a
 * stream that already delivered anything is never repeated, for that
 * would show its text twice. Nothing else is retried: a 401 would fail
 * the same way again, and a timeout usually means the model needed longer
 * than configured, not that the line was bad.
 */
export async function* streamChat(
  options: StreamOptions,
): AsyncGenerator<ProviderEvent> {
  for (let attempt = 0; ; attempt++) {
    let streamed = false;
    try {
      for await (const event of streamOnce(options)) {
        streamed = true;
        yield event;
      }
      return;
    } catch (error) {
      if (
        streamed ||
        attempt >= 2 ||
        options.signal?.aborted ||
        !transient(error)
      ) {
        throw error;
      }
      await pause(attempt === 0 ? 400 : 1200, options.signal);
    }
  }
}

/** A retry's pause, ended early when the teacher stops the request. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Whether a failure is worth another attempt, before anything streamed. */
function transient(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  if (error.code === "unreachable") return true;
  return error.status !== null && (error.status === 429 || error.status >= 500);
}

/**
 * One provider call, as `streamChat` runs it. See there for the options.
 */
async function* streamOnce(
  options: StreamOptions,
): AsyncGenerator<ProviderEvent> {
  // An idle deadline, not a total one: it restarts whenever the provider
  // sends anything. A model writing a long tool call (a whole new page of
  // exercises) streams for minutes without a visible word — that is work,
  // not a hang, and max_tokens bounds it anyway. Only silence for
  // `timeoutMs` — before the first byte or between two chunks — times out.
  const idle = new AbortController();
  const deadline = idle.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const restart = (): void => {
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        idle.abort(
          new DOMException("The AI provider went silent", "TimeoutError"),
        ),
      options.timeoutMs,
    );
  };
  restart();
  try {
    yield* readStream(options, deadline, restart);
  } finally {
    clearTimeout(timer);
  }
}

/** The request and stream of `streamOnce`, under its idle `deadline`. */
async function* readStream(
  options: StreamOptions,
  deadline: AbortSignal,
  restart: () => void,
): AsyncGenerator<ProviderEvent> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      ...(options.cacheKey ? { prompt_cache_key: options.cacheKey } : {}),
      ...(options.reasoningEffort
        ? { reasoning_effort: options.reasoningEffort }
        : {}),
      messages: options.messages,
      max_tokens: options.maxOutputTokens,
      stream: true,
      // The last chunk then carries the token counts the quota is built on.
      stream_options: { include_usage: true },
      ...(options.tools
        ? {
            tools: options.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
          }
        : {}),
    }),
    signal: AbortSignal.any([
      deadline,
      ...(options.signal ? [options.signal] : []),
    ]),
  }).catch((error: unknown) => {
    // The caller's signal fired (the editor disconnected): that is not a
    // provider answer, so the abort travels on and the route can tell the
    // two apart. Everything else failed on the way to the provider.
    if (options.signal?.aborted) throw error;
    throw cutOff(error, deadline);
  });

  if (!response.ok || !response.body) {
    // The response body is deliberately not read into the error message:
    // it can quote the request, prompts included.
    throw new ProviderError(
      `The AI provider answered ${response.status}`,
      "status",
      response.status,
    );
  }

  // Tool calls arrive as deltas too — an id and a name once, the arguments
  // piece by piece — and are only complete when the call is.
  const calls = new Map<number, { id: string; name: string; args: string }>();
  /** Per tool call: the argument length and path last reported. */
  const reported = new Map<number, { chars: number; path: string | null }>();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasContent = false;
  /** Reasoning text, kept aside: only used when `content` stayed empty. */
  let reasoning = "";
  let finish: "stop" | "length" | "tool_calls" | null = null;
  let done = false;
  let usage: {
    promptTokens: number;
    cachedPromptTokens: number;
    completionTokens: number;
  } | null = null;
  /** Events one SSE block produces, drained by the loop below. */
  const pending: ProviderEvent[] = [];

  /** Parses one SSE event block into `pending`; sets `done` on [DONE]. */
  const handleEvent = (event: string): void => {
    // SSE allows an event's payload as several `data:` lines, meant to be
    // joined by newlines — a provider or proxy may split one chunk across
    // them. Parsing each line on its own would drop such a chunk silently;
    // the payload only exists once the event block ends.
    let data: string | null = null;
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const part = line.slice("data:".length).trim();
      data = data === null ? part : `${data}\n${part}`;
    }
    if (data === null) return;
    if (data === "[DONE]") {
      done = true;
      return;
    }
    let chunk: {
      choices?: {
        delta?: {
          content?: unknown;
          reasoning_content?: unknown;
          reasoning?: unknown;
          tool_calls?: {
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }[];
        };
        finish_reason?: string | null;
      }[];
      usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
        // Mistral reports prefix-cache hits here; other providers use a
        // top-level field, so accept the common spellings.
        prompt_tokens_details?: { cached_tokens?: unknown };
        prompt_tokens_cached?: unknown;
        cached_tokens?: unknown;
      } | null;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      return; // A line that is not JSON — ignore it, keep streaming.
    }
    if (chunk.usage) {
      const prompt = Number(chunk.usage.prompt_tokens);
      const completion = Number(chunk.usage.completion_tokens);
      const cached = Number(
        chunk.usage.prompt_tokens_details?.cached_tokens ??
          chunk.usage.prompt_tokens_cached ??
          chunk.usage.cached_tokens,
      );
      if (
        Number.isFinite(prompt) ||
        Number.isFinite(completion) ||
        Number.isFinite(cached)
      ) {
        usage = {
          promptTokens: Number.isFinite(prompt) ? prompt : 0,
          cachedPromptTokens: Number.isFinite(cached) ? cached : 0,
          completionTokens: Number.isFinite(completion) ? completion : 0,
        };
      }
    }
    const choice = chunk.choices?.[0];
    const text = deltaText(choice?.delta?.content);
    if (text) {
      hasContent = true;
      pending.push({ type: "delta", text });
    }
    // Mistral's reasoning models think in content chunks, not a
    // reasoning field, so their thinking is gathered separately.
    const thought =
      thinkingText(choice?.delta?.content) +
      deltaText(choice?.delta?.reasoning_content) +
      deltaText(choice?.delta?.reasoning);
    if (thought) {
      reasoning += thought;
      pending.push({ type: "reasoning", text: thought });
    }
    for (const call of choice?.delta?.tool_calls ?? []) {
      const current = calls.get(call.index) ?? {
        id: "",
        name: "",
        args: "",
      };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name += call.function.name;
      if (call.function?.arguments) current.args += call.function.arguments;
      calls.set(call.index, current);
      // Reported when the call starts, when its path shows up, and then
      // every couple of KB — often enough to look alive, not per token.
      if (!current.name) continue;
      const last = reported.get(call.index);
      const path = last?.path ?? argumentPath(current.args);
      if (
        !last ||
        (path !== null && last.path === null) ||
        current.args.length - last.chars >= PROGRESS_STEP
      ) {
        reported.set(call.index, { chars: current.args.length, path });
        pending.push({
          type: "tool_progress",
          index: call.index,
          name: current.name,
          path,
          chars: current.args.length,
        });
      }
    }
    if (choice?.finish_reason === "stop") finish = "stop";
    if (choice?.finish_reason === "length") finish = "length";
    if (choice?.finish_reason === "tool_calls") finish = "tool_calls";
  };

  while (true) {
    let read: ReadableStreamReadResult<Uint8Array>;
    try {
      read = await reader.read();
    } catch (error) {
      // The stream died while reading. The teacher stopping the request
      // travels on as an abort; anything else is the provider's side.
      if (options.signal?.aborted) throw error;
      throw cutOff(error, deadline);
    }
    restart();
    const { done: streamDone, value } = read;
    buffer += decoder.decode(value, { stream: true });
    // SSE allows \n, \r\n and \r as line endings; normalize before splitting.
    buffer = buffer.replace(/\r\n?/g, "\n");
    // SSE events are separated by a blank line.
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      handleEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
      while (pending.length > 0) yield pending.shift()!;
      if (done) {
        yield* complete(calls, finish, hasContent, reasoning, usage);
        return;
      }
    }
    if (streamDone) break;
  }
  // A last event without a trailing blank line still counts.
  if (buffer.trim()) {
    handleEvent(buffer);
    while (pending.length > 0) yield pending.shift()!;
  }
  yield* complete(calls, finish, hasContent, reasoning, usage);
}

/** Arguments that arrive between two tool progress reports. */
const PROGRESS_STEP = 2048;

/**
 * The `path` of a tool call's arguments while they are still streaming —
 * the JSON is incomplete, so it is looked for, not parsed.
 */
function argumentPath(args: string): string | null {
  const match = /"(?:path|newPath)"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(args);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

/** What a finished stream yields at its end. */
function* complete(
  calls: Map<number, { id: string; name: string; args: string }>,
  finish: "stop" | "length" | "tool_calls" | null,
  hasContent: boolean,
  reasoning: string,
  usage: {
    promptTokens: number;
    cachedPromptTokens: number;
    completionTokens: number;
  } | null,
): Generator<ProviderEvent> {
  if (usage) yield { type: "usage", ...usage };
  if (finish === "length") {
    // Cut off by max_tokens: a tool call still being written has half its
    // arguments and must not run, and thinking cut short is not an answer.
    // The caller decides how to go on.
    yield { type: "finish", finish: "length" };
    return;
  }
  const complete = [...calls.values()].filter((call) => call.id && call.name);
  if (complete.length > 0) yield { type: "tool_calls", calls: complete };
  else if (!hasContent) {
    // Some relays put the whole visible answer where the content never
    // arrives — GLM-5.x in reasoning_content, for one. A call that ended
    // normally with only reasoning is answered with it rather than failing.
    if (reasoning.trim()) yield { type: "delta", text: reasoning };
    else
      throw new ProviderError(
        "The AI provider returned an empty answer",
        "empty",
      );
  }
  yield {
    type: "finish",
    finish: complete.length > 0 ? "tool_calls" : (finish ?? "stop"),
  };
}
