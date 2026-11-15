/*
 * An assistant answer as the chat shows it: thinking, tool steps and text
 * in the order they happened. A model that thinks, reads files, thinks
 * again and then writes gets two thinking blocks with the reads between
 * them — not one block that keeps filling up above everything else. The
 * server keeps the parts with the message; the editor builds them live
 * from the same events with the same function.
 */

export type AiAnswerPart =
  | {
      kind: "thinking";
      text: string;
      /** When it started (ms since epoch), while it is still open. */
      startedAt: number | null;
      /** How long it took, once the next part began. */
      ms: number | null;
    }
  | { kind: "tool"; name: string; detail: string | null }
  | { kind: "text"; text: string };

export type AiPartEvent =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; detail: string | null };

/** Closes an open thinking part: it gets its duration. */
function closed(part: AiAnswerPart, now: number): AiAnswerPart {
  return part.kind === "thinking" && part.ms === null
    ? { ...part, ms: now - (part.startedAt ?? now), startedAt: null }
    : part;
}

/**
 * The parts after one more event: thinking and text extend a part of
 * their kind right before them, anything else starts a new part (and ends
 * the thinking before it). Returns a new list; the old one is unchanged.
 */
export function addPart(
  parts: AiAnswerPart[],
  event: AiPartEvent,
  now = Date.now(),
): AiAnswerPart[] {
  const last = parts.at(-1);
  if (event.kind === "thinking" && last?.kind === "thinking" && last.ms === null) {
    return [...parts.slice(0, -1), { ...last, text: last.text + event.text }];
  }
  if (event.kind === "text" && last?.kind === "text") {
    return [...parts.slice(0, -1), { ...last, text: last.text + event.text }];
  }
  const before = last ? [...parts.slice(0, -1), closed(last, now)] : [];
  if (event.kind === "thinking")
    return [...before, { kind: "thinking", text: event.text, startedAt: now, ms: null }];
  if (event.kind === "text") return [...before, { kind: "text", text: event.text }];
  return [...before, { kind: "tool", name: event.name, detail: event.detail }];
}

/** Ends the answer: an open thinking part gets its duration. */
export function closeParts(parts: AiAnswerPart[], now = Date.now()): AiAnswerPart[] {
  const last = parts.at(-1);
  return last ? [...parts.slice(0, -1), closed(last, now)] : parts;
}

/**
 * The parts of an answer stored before they were kept: thinking, tools,
 * text — the order is lost, so this is the old layout.
 */
export function legacyParts(
  reasoning: string | null,
  tools: { name: string; detail: string | null }[],
  content: string,
): AiAnswerPart[] {
  return [
    ...(reasoning ? [{ kind: "thinking" as const, text: reasoning, startedAt: null, ms: null }] : []),
    ...tools.map((t) => ({ kind: "tool" as const, name: t.name, detail: t.detail })),
    ...(content ? [{ kind: "text" as const, text: content }] : []),
  ];
}
