import { useQuery } from "@tanstack/react-query";
import type { EditorView } from "@codemirror/view";
import i18next from "i18next";
import { api, unwrap } from "./api";
import {
  AI_ATTACHMENT_TEXT_MAX,
  AI_IMAGE_MAX,
  type AiAssistInput,
  type AiAttachment,
  type AiConversationSummary,
  type AiMessageView,
  type AiProposedChange,
  type ModelWeights,
} from "../../shared/schemas";

/*
 * The editor's side of the AI writing assistant (platforms/cloud/docs/cloud-ai-assistant.md):
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
  /** Names an admin gave models ("Fast"); a model without one shows its id. */
  modelLabels: Record<string, string>;
  /** Each model's cost weights for the token quota, per token kind. */
  modelWeights: Record<string, ModelWeights>;
  usedToday: number;
  quota: number | null;
  /** Weighted tokens ("credits") used in the current UTC week. */
  tokensUsedThisWeek: number;
  tokenQuota: number | null;
  /** The Monday the weekly credits refill, "YYYY-MM-DD". */
  tokensResetOn: string;
};

/**
 * A model's cost as one number: the average of its three weights — the
 * token multiplier models are compared and sorted by.
 */
export function weightValue(w: ModelWeights | undefined): number {
  return ((w?.in ?? 1) + (w?.cached ?? 1) + (w?.out ?? 1)) / 3;
}

/**
 * A model's cost hint for the picker, relative to the cheapest model: the
 * cheapest is ×1, the others scale up from it — one number a teacher can
 * compare, without the tiny price-calibrated weights (e.g. 0.000017).
 * Two significant digits, so small differences stay distinguishable.
 */
export function formatRelativeCost(
  w: ModelWeights | undefined,
  cheapest: number,
): string {
  const factor = weightValue(w) / (cheapest > 0 ? cheapest : 1);
  return factor === 1 ? "1" : factor.toPrecision(2);
}

/** `enabled` false: never asks (link visitors have no AI). */
export function useAiStatus(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["ai-status"],
    queryFn: () => unwrap(api.ai.$get()) as Promise<AiStatus>,
    // Counters change on the server; pick fresh ones up quickly.
    staleTime: 5_000,
  });
}

/** One event of the route's stream; see the plan for the shapes. */
export type AssistEvent =
  | { event: "conversation"; id: number; title: string; userMessageId: number }
  | { event: "delta"; text: string }
  | { event: "reasoning"; text: string }
  | { event: "toolProgress"; name: string; path: string | null; chars: number }
  | { event: "tool"; name: string; detail: string | null }
  | { event: "saved"; messageId: number }
  | { event: "usage"; tokensUsedThisWeek: number; tokenQuota: number | null }
  | { event: "proposal"; changes: AiProposedChange[] }
  | {
      event: "done";
      finish: "stop" | "length" | "steps";
      messageId?: number;
      durationMs?: number;
      /** What the answer cost; absent from streams of older servers. */
      usage?: { tokensIn: number; tokensCached: number; tokensOut: number; credits: number };
    }
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
  /** Whether the stream reached its end or failed with an error event. */
  let ended = false;
  /** Parses one SSE event block and reports it. */
  const handleEvent = (raw: string) => {
    let event: string | null = null;
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:"))
        // SSE joins an event's data lines with newlines; the route writes
        // one line, but parsing them the way the spec joins them stays
        // correct for any peer that splits a payload.
        data += data ? `\n${line.slice(5).trim()}` : line.slice(5).trim();
    }
    if (!event) return;
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      switch (event) {
        case "conversation":
          onEvent({
            event: "conversation",
            id: Number(parsed.id),
            title: String(parsed.title),
            userMessageId: Number(parsed.userMessageId),
          });
          break;
        case "delta":
          onEvent({ event: "delta", text: String(parsed.text) });
          break;
        case "reasoning":
          onEvent({ event: "reasoning", text: String(parsed.text) });
          break;
        case "toolProgress":
          onEvent({
            event: "toolProgress",
            name: String(parsed.name),
            path: typeof parsed.path === "string" ? parsed.path : null,
            chars: Number(parsed.chars) || 0,
          });
          break;
        case "tool":
          onEvent({
            event: "tool",
            name: String(parsed.name),
            detail: typeof parsed.detail === "string" ? parsed.detail : null,
          });
          break;
        case "saved":
          onEvent({ event: "saved", messageId: Number(parsed.messageId) });
          break;
        case "proposal":
          onEvent({
            event: "proposal",
            changes: parsed.changes as AiProposedChange[],
          });
          break;
        case "usage":
          onEvent({
            event: "usage",
            tokensUsedThisWeek: Number(parsed.tokensUsedThisWeek),
            tokenQuota:
              parsed.tokenQuota === null ? null : Number(parsed.tokenQuota),
          });
          break;
        case "done":
          ended = true;
          onEvent({
            event: "done",
            finish:
              parsed.finish === "length" || parsed.finish === "steps"
                ? parsed.finish
                : "stop",
            messageId:
              typeof parsed.messageId === "number" ? parsed.messageId : undefined,
            durationMs:
              typeof parsed.durationMs === "number" ? parsed.durationMs : undefined,
            usage:
              parsed.usage && typeof parsed.usage === "object"
                ? (() => {
                    const usage = parsed.usage as Record<string, unknown>;
                    return {
                      tokensIn: Number(usage.tokensIn) || 0,
                      tokensCached: Number(usage.tokensCached) || 0,
                      tokensOut: Number(usage.tokensOut) || 0,
                      credits: Number(usage.credits) || 0,
                    };
                  })()
                : undefined,
          });
          break;
        case "error":
          ended = true;
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
  // The stream ended without `done` or `error`: the connection was cut
  // between the editor and the platform (a proxy timeout, a server
  // restart) and what arrived is incomplete. A report beats an answer
  // that quietly stops mid-sentence.
  if (!ended)
    onEvent({
      event: "error",
      message: i18next.t("editor.ai.dropped"),
      code: "dropped",
    });
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

/* Conversations, kept by the server per teacher and book. */

async function json<T>(response: Promise<Response>): Promise<T> {
  return (await unwrap(response as Promise<Response>)) as T;
}

export function listConversations(bookId: number) {
  return json<{ conversations: AiConversationSummary[] }>(
    fetch(`/api/books/${bookId}/ai/conversations`),
  ).then((r) => r.conversations);
}

export function loadConversation(bookId: number, id: number) {
  return json<{ id: number; title: string; messages: AiMessageView[] }>(
    fetch(`/api/books/${bookId}/ai/conversations/${id}`),
  );
}

export function renameConversation(bookId: number, id: number, title: string) {
  return json(
    fetch(`/api/books/${bookId}/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
}

export function deleteConversation(bookId: number, id: number) {
  return json(
    fetch(`/api/books/${bookId}/ai/conversations/${id}`, { method: "DELETE" }),
  );
}

/** Tells the server the teacher decided on a proposal, so it stops carrying over. */
export function decideProposal(
  bookId: number,
  conversationId: number,
  messageId: number,
  status: "applied" | "denied",
) {
  return json(
    fetch(
      `/api/books/${bookId}/ai/conversations/${conversationId}/messages/${messageId}/proposal`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    ),
  );
}

/* Attachments: images scaled down in the browser, documents as their text. */

/** The longest side an attached image is scaled to. */
const IMAGE_SIDE = 1600;
const TEXT_TYPES = /^(text\/|application\/(json|xml|x-yaml|yaml))/;
const TEXT_EXTENSIONS =
  /\.(md|txt|typ|csv|tsv|json|ya?ml|xml|html?|css|js|ts|tsx|jsx|py|java|sql|tex|c|cpp|h)$/i;

/** Whether the editor can turn this file into an attachment. */
export function attachable(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    TEXT_TYPES.test(file.type) ||
    TEXT_EXTENSIONS.test(file.name)
  );
}

/**
 * A file as an attachment: an image as a JPEG data URL no larger than
 * IMAGE_SIDE (a photo of a worksheet reads fine at that size and costs a
 * fraction), a PDF as its text, a text file as itself.
 */
export async function toAttachment(file: File): Promise<AiAttachment> {
  if (file.type.startsWith("image/")) {
    const data = await scaledImage(file);
    if (data.length > AI_IMAGE_MAX) throw new Error(i18next.t("editor.ai.attachTooLarge", { name: file.name }));
    return { kind: "image", name: file.name, data };
  }
  const text =
    file.type === "application/pdf" ? await pdfText(file) : await file.text();
  if (!text.trim()) throw new Error(i18next.t("editor.ai.attachEmpty", { name: file.name }));
  return {
    kind: "text",
    name: file.name,
    text: text.slice(0, AI_ATTACHMENT_TEXT_MAX),
  };
}

async function scaledImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d")!;
  // A transparent PNG becomes JPEG: white, not black, behind it.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** A PDF's text, page by page, read with the pdf.js the PDF view loads. */
async function pdfText(file: File): Promise<string> {
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
        .join(""),
    );
    if (pages.join("").length > AI_ATTACHMENT_TEXT_MAX) break;
  }
  await pdf.cleanup();
  return pages.map((text, i) => `--- Page ${i + 1} ---\n${text}`).join("\n\n");
}
