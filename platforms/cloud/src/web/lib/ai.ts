import { useQuery } from "@tanstack/react-query";
import type { EditorView } from "@codemirror/view";
import { api, unwrap } from "./api";
import type { AiAssistInput, AiProposedChange } from "../../shared/schemas";

/*
 * The editor's side of the AI writing assistant (docs/cloud-ai-assistant.md):
 * a typed status query, and a streaming request that reads the route's
 * Server-Sent Events — the shared `hc` client cannot stream, so this is a
 * plain fetch whose body is parsed event by event, the same way the server
 * parses the provider's stream.
 */

export type AiStatus = {
  enabled: boolean;
  model: string | null;
  /** Models the teacher may pick; `model` is the default (first). */
  models: string[];
  allowed: boolean;
  usedToday: number;
  quota: number | null;
};

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () => unwrap(api.ai.$get()) as Promise<AiStatus>,
    // Counters change on the server; pick fresh ones up quickly.
    staleTime: 5_000,
  });
}

/** One event of the route's stream; see the plan for the shapes. */
export type AssistEvent =
  | { event: "delta"; text: string }
  | { event: "tool"; name: string; args: Record<string, unknown> }
  | { event: "proposal"; changes: AiProposedChange[] }
  | { event: "done"; finish: "stop" | "length" | "error" }
  | { event: "error"; message: string; code: string };

/**
 * Runs one request and reports every event as it arrives, until `done` or
 * `error`. `signal` stops the request — and the provider call behind it.
 */
export async function assist(
  bookId: number,
  input: AiAssistInput,
  onEvent: (event: AssistEvent) => void,
  signal: AbortSignal,
) {
  const response = await fetch(`/api/books/${bookId}/ai/assist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) {
    // Ordinary errors, like every other route's: translated on the server.
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  /** Parses one SSE event block and reports it. */
  const handleEvent = (raw: string) => {
    let event: string | null = null;
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!event) return;
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      switch (event) {
        case "delta":
          onEvent({ event: "delta", text: String(parsed.text) });
          break;
        case "tool":
          onEvent({
            event: "tool",
            name: String(parsed.name),
            args: (parsed.args as Record<string, unknown>) ?? {},
          });
          break;
        case "proposal":
          onEvent({
            event: "proposal",
            changes: parsed.changes as AiProposedChange[],
          });
          break;
        case "done":
          onEvent({
            event: "done",
            finish:
              parsed.finish === "length" || parsed.finish === "error"
                ? parsed.finish
                : "stop",
          });
          break;
        case "error":
          onEvent({
            event: "error",
            message: String(parsed.message),
            code: String(parsed.code),
          });
          break;
      }
    } catch {
      // An event without JSON data — ignore it, keep streaming.
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: true });
    // SSE allows \n, \r\n and \r as line endings; normalize before splitting.
    buffer = buffer.replace(/\r\n?/g, "\n");
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      handleEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
    }
    if (done) break;
  }
  // A last event without a trailing blank line still counts.
  if (buffer.trim()) handleEvent(buffer);
}

/* Building the request from the editor's own state. */

const MAX_SELECTION = 16_000;
const CONTEXT_LINES = 20;

/**
 * The editor's selection, if the teacher made one; for `improve`.
 * `truncated` tells the panel the selection was longer than what was sent —
 * "Replace selection" must not delete the part the assistant never saw.
 */
export function selectionOf(
  view: EditorView,
): { text: string; truncated: boolean } | null {
  const selection = view.state.selection.main;
  if (selection.empty) return null;
  const full = view.state.sliceDoc(selection.from, selection.to);
  const text = full.slice(0, MAX_SELECTION);
  return text ? { text, truncated: full.length > MAX_SELECTION } : null;
}

/** The lines around the cursor, so the assistant sees the page it writes on. */
export function contextOf(view: EditorView): string {
  const selection = view.state.selection.main;
  const doc = view.state.doc;
  const line = doc.lineAt(selection.empty ? selection.head : selection.from);
  const from = Math.max(1, line.number - CONTEXT_LINES);
  const to = Math.min(doc.lines, line.number + CONTEXT_LINES);
  return view.state
    .sliceDoc(doc.line(from).from, doc.line(to).to)
    .slice(0, 16_000);
}
