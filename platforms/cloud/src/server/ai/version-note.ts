import type { Locale } from "../../shared/i18n";
import type { EffectiveAi } from "../domain/instance";
import { logCommits, rangeDiff } from "../hosting/git";
import { ProviderError, streamChat } from "./provider";

/** The diff the model reads; a big upload is cut, its file list stays. */
const MAX_DIFF_CHARS = 16_000;
/** The note field holds 200 characters. */
const MAX_NOTE_CHARS = 200;

const LANGUAGE: Record<Locale, string> = { en: "English", de: "German" };

export type NoteUsage = { promptTokens: number; cachedPromptTokens: number; completionTokens: number };

/**
 * A short note for the version that publishing would make: what changed
 * between the live version (`live`, null: nothing published yet) and the
 * latest save (`head`), as a teacher would write it in a version list.
 * One plain call without tools; `onUsage` is told what it cost.
 */
export async function suggestVersionNote(options: {
  ai: EffectiveAi;
  repo: string;
  live: string | null;
  head: string;
  locale: Locale;
  signal?: AbortSignal;
  onUsage: (usage: NoteUsage) => void;
}): Promise<string> {
  const { ai, repo, live, head } = options;
  const [diff, commits] = await Promise.all([
    rangeDiff(repo, live, head),
    logCommits(repo, { limit: 30, after: null, exclude: live }),
  ]);
  if (!diff) return "";
  const files = diff
    .split("\n")
    .filter((line) => line.startsWith("diff --git "))
    .map((line) => line.replace(/^diff --git a\/(.*) b\/.*$/, "$1"));
  const cut = diff.length > MAX_DIFF_CHARS;
  const user = [
    live ? "Changes since the live version:" : "The first version of the book:",
    `Files (${files.length}): ${files.slice(0, 60).join(", ")}${files.length > 60 ? ", …" : ""}`,
    ...(commits.length > 0 ? [`Saves: ${commits.map((c) => c.message).join(" | ")}`] : []),
    "",
    `Diff${cut ? " (cut short)" : ""}:`,
    diff.slice(0, MAX_DIFF_CHARS),
  ].join("\n");

  const messages = [
    {
      role: "system" as const,
      content:
        "You name versions of a school book written in Markdown (a Hyperbook) for its version list. " +
        "Given what changed, write ONE short note for the new version: what a teacher or student would notice, " +
        'e.g. "New chapter on lenses, typos in the intro fixed". At most 80 characters, no version number, ' +
        "no quotes, no trailing period, no Markdown. Leave out technical details such as file names or config, " +
        "unless nothing else changed. " +
        `Write it in ${LANGUAGE[options.locale]}. Answer with the note only.`,
    },
    { role: "user" as const, content: user },
  ];

  // Asked as the assistant asks: a provider that rejects the reasoning
  // effort (400) is asked again without it, and a model that thought its
  // whole budget away without writing the note gets the full budget once.
  let reasoningEffort: "low" | undefined = "low";
  let maxOutputTokens = Math.min(ai.maxOutputTokens, 4_000);
  for (;;) {
    let text = "";
    let finish = "stop";
    try {
      for await (const event of streamChat({
        baseUrl: ai.baseUrl,
        apiKey: ai.apiKey,
        model: ai.model,
        messages,
        maxOutputTokens,
        timeoutMs: ai.timeoutMs,
        reasoningEffort,
        signal: options.signal,
      })) {
        if (event.type === "delta") text += event.text;
        else if (event.type === "usage") options.onUsage(event);
        else if (event.type === "finish") finish = event.finish;
      }
    } catch (error) {
      if (error instanceof ProviderError && error.status === 400 && reasoningEffort) {
        reasoningEffort = undefined;
        continue;
      }
      throw error;
    }
    if (finish === "length" && !text.trim() && maxOutputTokens < ai.maxOutputTokens) {
      maxOutputTokens = ai.maxOutputTokens;
      reasoningEffort = undefined;
      continue;
    }
    return cleanNote(text);
  }
}

/** The first line of the answer, without the quotes or label a model may add. */
export function cleanNote(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "";
  const note = line
    .replace(/^(note|notiz|version note)\s*:\s*/i, "")
    .replace(/^["'“„«`*]+/, "")
    // Closing quotes and a final period, in either order („…“. or "….").
    .replace(/["'”“»`*.]+$/, "")
    .trim();
  return note.length > MAX_NOTE_CHARS ? `${note.slice(0, MAX_NOTE_CHARS - 1).trimEnd()}…` : note;
}
