/*
 * A client for the OpenAI chat-completions protocol — the one API the
 * assistant needs, because every provider speaks it: Mistral, OpenAI,
 * Anthropic through its compatibility layer, OpenRouter, and a local
 * Ollama or vLLM. See docs/cloud-ai-assistant.md.
 */

/** One message of the conversation, in the provider's terms. */
export type ChatMessage =
  | { role: "system" | "user"; content: string }
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
    readonly code: "unreachable" | "status" | "empty",
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** What one provider call yields while it runs. */
export type ProviderEvent =
  | { type: "delta"; text: string }
  | { type: "tool_calls"; calls: ProviderToolCall[] }
  | { type: "usage"; promptTokens: number; completionTokens: number }
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
 * Calls `{baseUrl}/chat/completions` with `stream: true` and yields what
 * happens: the assistant's text as it arrives, the tool calls it made once
 * complete, then how the call ended. `signal` (a disconnecting reader)
 * aborts the provider call; the timeout covers the whole request, streaming
 * included.
 */
export async function* streamChat(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  timeoutMs: number;
  /** OpenAI-style tool definitions; omitted: a plain text answer. */
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}): AsyncGenerator<ProviderEvent> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
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
      AbortSignal.timeout(options.timeoutMs),
      ...(options.signal ? [options.signal] : []),
    ]),
  }).catch((error: unknown) => {
    // The caller's signal fired (the editor disconnected): that is not a
    // provider answer, so the abort travels on and the route can tell the
    // two apart. Only a failed call becomes "unreachable".
    if (options.signal?.aborted) throw error;
    throw new ProviderError(
      "The AI provider could not be reached",
      "unreachable",
    );
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
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasContent = false;
  /** Reasoning text, kept aside: only used when `content` stayed empty. */
  let reasoning = "";
  let finish: "stop" | "length" | "tool_calls" | null = null;
  let done = false;
  let usage: { promptTokens: number; completionTokens: number } | null = null;
  /** Events one SSE block produces, drained by the loop below. */
  const pending: ProviderEvent[] = [];

  /** Parses one SSE event block into `pending`; sets `done` on [DONE]. */
  const handleEvent = (event: string): void => {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice("data:".length).trim();
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
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null;
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue; // A line that is not JSON — ignore it, keep streaming.
      }
      if (chunk.usage) {
        const prompt = Number(chunk.usage.prompt_tokens);
        const completion = Number(chunk.usage.completion_tokens);
        if (Number.isFinite(prompt) || Number.isFinite(completion)) {
          usage = {
            promptTokens: Number.isFinite(prompt) ? prompt : 0,
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
      reasoning += deltaText(choice?.delta?.reasoning_content);
      reasoning += deltaText(choice?.delta?.reasoning);
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
      }
      if (choice?.finish_reason === "stop") finish = "stop";
      if (choice?.finish_reason === "length") finish = "length";
      if (choice?.finish_reason === "tool_calls") finish = "tool_calls";
    }
  };

  while (true) {
    const { done: streamDone, value } = await reader.read();
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

/** What a finished stream yields at its end. */
function* complete(
  calls: Map<number, { id: string; name: string; args: string }>,
  finish: "stop" | "length" | "tool_calls" | null,
  hasContent: boolean,
  reasoning: string,
  usage: { promptTokens: number; completionTokens: number } | null,
): Generator<ProviderEvent> {
  if (usage) yield { type: "usage", ...usage };
  const complete = [...calls.values()].filter((call) => call.id && call.name);
  if (complete.length > 0) yield { type: "tool_calls", calls: complete };
  else if (!hasContent) {
    // Reasoning models (z.ai's GLM-5.x, for one) sometimes put the whole
    // visible answer into reasoning_content and leave content empty — use
    // that rather than failing the request with "empty".
    if (reasoning.trim()) yield { type: "delta", text: reasoning };
    else throw new ProviderError("The AI provider returned an empty answer", "empty");
  }
  yield {
    type: "finish",
    finish: complete.length > 0 ? "tool_calls" : (finish ?? "stop"),
  };
}
