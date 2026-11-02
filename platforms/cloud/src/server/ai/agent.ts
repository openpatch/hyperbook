/*
 * The assistant's agent: how a request becomes a provider conversation,
 * how the model may look through the whole book (read tools), and how it
 * may propose file changes (changing tools, onto an in-memory overlay —
 * the teacher reviews the proposal, the repository is never touched).
 * See platforms/cloud/docs/cloud-ai-assistant.md.
 */

import {
  bookPathProblem,
  type AiAssistInput,
  type AiProposedChange,
} from "../../shared/schemas";
import type { EffectiveAi } from "../domain/instance";
import {
  diffChange,
  headCommit,
  listTree,
  readBlob,
  type TreeEntry,
} from "../hosting/git";
import { DOCUMENTATION, documentationKey, readDocumentation } from "./docs";
import { SYSTEM_PROMPT } from "./prompt";
import {
  type ChatMessage,
  type ProviderToolCall,
  type ToolDefinition,
  streamChat,
} from "./provider";

/** What the editor's stream receives while the assistant runs. */
export type AssistantEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string; args: Record<string, unknown> }
  | {
      type: "usage";
      promptTokens: number;
      /** Prompt tokens the provider served from its prefix cache. */
      cachedPromptTokens: number;
      completionTokens: number;
    }
  | { type: "proposal"; changes: AiProposedChange[] }
  | { type: "done"; finish: "stop" | "length" };

/** The part of the file tree the baseline context mentions. */
const TREE_LIMIT = 100;
/** A page up to this size goes into the prompt whole; a bigger one as an excerpt. */
const PAGE_INLINE_MAX = 8 * 1024;
/** Read results older than this many tool rounds are replaced by a stub. */
const KEEP_ROUNDS = 2;
/** Only results bigger than this are worth replacing. */
const PRUNE_MIN = 2 * 1024;

/** Per read_file call. */
const READ_MAX = 32 * 1024;
/** Per request. */
const READ_BUDGET = 128 * 1024;
/** Per write_file call. */
const WRITE_MAX = 32 * 1024;
/** Per request, across all writes. */
const WRITE_BUDGET = 256 * 1024;
/** Files one read_files call may name. */
const READ_FILES_MAX = 8;
/** Files per proposal. */
const CHANGE_LIMIT = 10;
/** Per request, across all searches. */
const SEARCH_BUDGET = 256 * 1024;
/** Matches one search may report. */
const SEARCH_MATCHES_MAX = 50;
/** Files bigger than this are not searched. */
const SEARCH_FILE_MAX = 256 * 1024;

/** Extensions the tools read and write; binaries are not the assistant's. */
const TEXT_EXTENSIONS = new Set([
  "bitflow",
  "blockflow",
  "c",
  "cfg",
  "conf",
  "cpp",
  "cs",
  "css",
  "csv",
  "excalidraw",
  "go",
  "h",
  "hpp",
  "htm",
  "html",
  "java",
  "jmp",
  "js",
  "json",
  "jsx",
  "kt",
  "learningmap",
  "md",
  "mermaid",
  "mjs",
  "php",
  "py",
  "rb",
  "rs",
  "sass",
  "scss",
  "sh",
  "sql",
  "struktolab",
  "svg",
  "ts",
  "tsv",
  "tsx",
  "txt",
  "typ",
  "typst",
  "xml",
  "yaml",
  "yml",
]);

function extension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

function isText(path: string): boolean {
  return TEXT_EXTENSIONS.has(extension(path));
}

/*
 * The tools, in the order the system prompt talks about them. The prompt
 * says when to use which; the descriptions say only what each one does —
 * every step resends them. `read_file` is still answered (as a one-path
 * read_files) for models that guess it, but not offered.
 */
const TOOLS: ToolDefinition[] = [
  {
    name: "read_files",
    description: `Read text files of the book, at most ${READ_FILES_MAX} per call. The open page is the editor's version, unsaved changes included.`,
    parameters: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
      },
      required: ["paths"],
    },
  },
  {
    name: "search_files",
    description:
      "Search the book's text files with a regular expression, per line; answers path:line: text.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: 'A JavaScript regular expression, e.g. "::bitflow|::jmp".',
        },
        pathPrefix: {
          type: "string",
          description: 'Only files whose path starts with this, e.g. "book/".',
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_files",
    description:
      "All the book's files with their sizes, pending changes included. The prompt lists the first ones.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "read_docs",
    description:
      "Documentation of one hyperbook element or file format (attributes, syntax, examples), or of the format itself (markdown, page-config, book-config).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", enum: Object.keys(DOCUMENTATION) },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_file",
    description:
      "Change an existing file by replacing passages: each old_text must occur exactly once in the file's current text (copy it exactly, with enough lines to be unique). An empty old_text appends new_text to the end of the file. All edits apply, or none.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              old_text: { type: "string" },
              new_text: { type: "string" },
            },
            required: ["old_text", "new_text"],
          },
        },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "write_file",
    description: "Create a file, or replace a file's whole content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "The complete new text." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "rename_file",
    description: "Move a text file to a new, unused path, keeping its content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        newPath: { type: "string" },
      },
      required: ["path", "newPath"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

type Book = {
  commit: string | null;
  /** The head tree, by path. */
  tree: Map<string, TreeEntry>;
  name: string;
  language: string;
};

async function loadBook(repo: string): Promise<Book> {
  const commit = await headCommit(repo).catch(() => null);
  const entries = commit ? await listTree(repo, commit) : [];
  let name = "";
  let language = "en";
  const settings = entries.find((entry) => entry.path === "hyperbook.json");
  if (settings) {
    try {
      const parsed = JSON.parse(
        (await readBlob(repo, settings.oid)).toString("utf8"),
      );
      if (typeof parsed.name === "string") name = parsed.name;
      if (typeof parsed.language === "string") language = parsed.language;
    } catch {
      // A broken hyperbook.json: the build reports that, not the assistant.
    }
  }
  return {
    commit,
    tree: new Map(entries.map((entry) => [entry.path, entry])),
    name,
    language,
  };
}

/** One recorded file change, before its diff is computed. */
type OverlayChange = {
  baseOid: string | null;
  oldText: string | null;
  newText: string;
};

/**
 * The agent's tools, onto one request's overlay: reads see what writes
 * recorded, the listing sees both, and the proposal folds the overlay into
 * reviewable, diffed changes. The repository is read, never written.
 */
class Tools {
  private readBudget = READ_BUDGET;
  private writeBudget = WRITE_BUDGET;
  private searchBudget = SEARCH_BUDGET;
  readonly overlay = new Map<string, OverlayChange>();
  readonly deletes = new Set<string>();
  /** Files and docs already handed to the model; the history has them. */
  private readonly seen = new Set<string>();

  constructor(
    private readonly repo: string,
    private readonly book: Book,
    private readonly input: AiAssistInput,
  ) {
    // A page small enough to be in the prompt is not sent a second time.
    if (input.pageText !== undefined && input.pageText.length <= PAGE_INLINE_MAX)
      this.seen.add(`file:${input.pagePath}`);
  }

  /** The committed text of a file, when it is small enough to diff against. */
  private async committedText(path: string): Promise<string | null> {
    const entry = this.book.tree.get(path);
    if (!entry || entry.size > 4 * READ_MAX) return null;
    try {
      return (await readBlob(this.repo, entry.oid)).toString("utf8");
    } catch {
      return null;
    }
  }

  /** The old text a write's diff is against: unsaved page or repo. */
  private async oldTextOf(path: string): Promise<string | null> {
    if (path === this.input.pagePath && this.input.pageText !== undefined) {
      return this.input.pageText;
    }
    return await this.committedText(path);
  }

  listing(): string {
    const files = new Map(
      [...this.book.tree]
        .filter(([path]) => !this.deletes.has(path))
        .map(([path, entry]) => [path, entry.size] as const),
    );
    for (const [path, change] of this.overlay)
      files.set(path, change.newText.length);
    const lines = [...files.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, size]) => `- ${path} (${size} bytes)`);
    return lines.length > 0 ? lines.join("\n") : "(the book has no files yet)";
  }

  /**
   * The answer for a path that does not exist: files with the same name or
   * in the same folder, not the whole listing — that is in the prompt.
   */
  missing(path: string): string {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const folder = path.slice(0, path.lastIndexOf("/") + 1);
    const paths = [...this.book.tree.keys(), ...this.overlay.keys()].filter(
      (p) => !this.deletes.has(p),
    );
    const near = [
      ...new Set([
        ...paths.filter((p) => p.endsWith(`/${name}`) || p === name),
        ...paths.filter((p) => folder && p.startsWith(folder)),
      ]),
    ].slice(0, 10);
    return near.length > 0
      ? `No file with that path. Similar: ${near.join(", ")}`
      : "No file with that path; call list_files for the paths.";
  }

  /** Lets a file or doc whose result left the history be read again. */
  forget(key: string): void {
    this.seen.delete(key);
  }

  /** Answers once per request: a second ask points back at the history. */
  firstTime(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  async readMany(paths: unknown): Promise<string> {
    if (!Array.isArray(paths) || paths.length === 0) {
      return "read_files needs `paths`, a list of file paths.";
    }
    const valid = paths.filter(
      (p): p is string => typeof p === "string" && !bookPathProblem(p),
    );
    const unique = [...new Set(valid)].slice(0, READ_FILES_MAX);
    const parts: string[] = [];
    for (const path of unique) {
      parts.push(`=== ${path} ===\n${await this.readOnce(path)}`);
    }
    if (valid.length > unique.length || valid.length < paths.length) {
      parts.push(
        `(Only ${unique.length} valid, distinct paths were read; at most ${READ_FILES_MAX} per call.)`,
      );
    }
    return parts.join("\n\n");
  }

  /** read(), but a file the model already has is not sent again. */
  async readOnce(path: string): Promise<string> {
    if (this.overlay.has(path) || !this.firstTime(`file:${path}`)) {
      return this.overlay.has(path)
        ? await this.read(path)
        : "Already read earlier in this conversation; see that result above.";
    }
    return await this.read(path);
  }

  async read(path: string): Promise<string> {
    if (this.overlay.has(path)) return this.overlay.get(path)!.newText;
    if (this.deletes.has(path)) return "That file was deleted in this request.";
    if (path === this.input.pagePath && this.input.pageText !== undefined) {
      // The open page counts against the same budget as repo reads, and is
      // truncated like them — a huge page must not flood the conversation.
      const text = this.input.pageText;
      if (text.length > this.readBudget) {
        return "The open page does not fit this request's read budget anymore; ask about parts of it instead.";
      }
      this.readBudget -= Math.min(text.length, READ_MAX);
      const body =
        text.length > READ_MAX
          ? `${text.slice(0, READ_MAX)}\n… (truncated at ${READ_MAX} bytes)`
          : text;
      return `${body}\n\n(The editor's current version, unsaved changes included.)`;
    }
    const entry = this.book.tree.get(path);
    if (!entry) return this.missing(path);
    if (!isText(path))
      return "That file is not a text file; the assistant reads text only.";
    if (entry.size > this.readBudget) {
      return `That file is too large for this request (${entry.size} bytes). Ask about parts of it instead.`;
    }
    const text = (await readBlob(this.repo, entry.oid)).toString("utf8");
    this.readBudget -= Math.min(text.length, READ_MAX);
    return text.length > READ_MAX
      ? `${text.slice(0, READ_MAX)}\n… (truncated at ${READ_MAX} bytes)`
      : text;
  }

  /** The current text of a file: pending write, the open page, or the repo. */
  private async contentOf(path: string): Promise<string | null> {
    if (this.overlay.has(path)) return this.overlay.get(path)!.newText;
    if (this.deletes.has(path)) return null;
    if (path === this.input.pagePath && this.input.pageText !== undefined)
      return this.input.pageText;
    const entry = this.book.tree.get(path);
    if (!entry || !isText(path) || entry.size > SEARCH_FILE_MAX) return null;
    try {
      return (await readBlob(this.repo, entry.oid)).toString("utf8");
    } catch {
      return null;
    }
  }

  /** Searches the book's text files (pending writes included) for a regex, per line. */
  async search(pattern: unknown, pathPrefix: unknown): Promise<string> {
    if (typeof pattern !== "string" || !pattern) {
      return 'search_files needs a `pattern` — a regular expression, e.g. "TODO|FIXME".';
    }
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return `search_files: "${pattern}" is not a valid regular expression.`;
    }
    const prefix =
      typeof pathPrefix === "string" && pathPrefix ? pathPrefix : null;
    const inScope = (path: string): boolean =>
      isText(path) && !this.deletes.has(path) && (!prefix || path.startsWith(prefix));
    const paths = [...new Set([...this.book.tree.keys(), ...this.overlay.keys()])]
      .filter(inScope)
      .sort();
    const skipped = [...this.book.tree.keys()].filter(
      (path) => inScope(path) && (this.book.tree.get(path)?.size ?? 0) > SEARCH_FILE_MAX,
    );
    const matches: string[] = [];
    let overflow = 0;
    for (const path of paths) {
      if (this.searchBudget <= 0) break;
      const text = await this.contentOf(path);
      if (text === null) continue;
      this.searchBudget -= Math.min(text.length, SEARCH_FILE_MAX);
      text.split("\n").forEach((line, i) => {
        if (!regex.test(line)) return;
        if (matches.length < SEARCH_MATCHES_MAX) {
          matches.push(`${path}:${i + 1}: ${line.trim().slice(0, 200)}`);
        } else {
          overflow++;
        }
      });
    }
    const parts = [matches.length > 0 ? matches.join("\n") : "(no matches)"];
    if (overflow > 0)
      parts.push(`(${overflow} more matches not shown; narrow the pattern or pathPrefix)`);
    if (skipped.length > 0)
      parts.push(`(not searched, too large: ${skipped.join(", ")})`);
    return parts.join("\n");
  }

  /** Moves a file in the proposal: old path deleted, new path created with the same text. */
  async rename(path: string, newPath: string): Promise<string> {
    if (path === newPath) return "The new path is the same as the old one.";
    if (!isText(path) || !isText(newPath))
      return "Only text files can be renamed.";
    if (this.deletes.has(path))
      return "That file is already deleted in this request.";
    const overlayEntry = this.overlay.get(path);
    const treeEntry = this.book.tree.get(path);
    if (!overlayEntry && !treeEntry)
      return this.missing(path);
    if (
      this.overlay.has(newPath) ||
      this.book.tree.has(newPath) ||
      this.deletes.has(newPath)
    ) {
      return `There is already a file with the path ${newPath}; choose another, or delete_file it first.`;
    }
    const content =
      overlayEntry?.newText ?? (await this.committedText(path)) ?? "";
    if (content.length > this.writeBudget) {
      return "The request's write budget is used up; rename a smaller file or summarize instead.";
    }
    if (
      this.overlay.size + this.deletes.size >= CHANGE_LIMIT &&
      !this.overlay.has(newPath)
    ) {
      return `Too many changes for one proposal (at most ${CHANGE_LIMIT} files).`;
    }
    this.writeBudget -= content.length;
    this.overlay.delete(path);
    // A file that existed in the repo is deleted there; a file created in
    // this request simply stops existing under the old name.
    const baseOid = overlayEntry?.baseOid ?? treeEntry?.oid ?? null;
    if (baseOid !== null) this.deletes.add(path);
    this.overlay.set(newPath, { baseOid: null, oldText: null, newText: content });
    return `Recorded: ${path} renamed to ${newPath}. Fix links that point to it.`;
  }

  async write(
    path: string,
    content: unknown,
    // An edit sends only its passages: a long file it changes is not output
    // the model wrote, so neither the per-file cap nor the full size count.
    { max = WRITE_MAX, cost }: { max?: number; cost?: number } = {},
  ): Promise<string> {
    if (typeof content !== "string" || content.length === 0) {
      return "write_file needs the file's complete new text as `content`.";
    }
    if (!isText(path)) return "Only text files can be written.";
    // Only a page the request knows completely may be rewritten: an excerpt
    // is not a file, and a write built from one would lose content.
    if (path === this.input.pagePath && this.input.pageText === undefined) {
      return "The open page was sent only as an excerpt, so rewriting it could lose content. Give the teacher the new text as your answer instead; they insert it where they want it.";
    }
    // A committed file too large to diff would show up as a "new file" whose
    // diff is all additions, while accepting overwrites it — so it is not
    // proposed at all; the teacher edits such files in the editor.
    const committed = this.book.tree.get(path);
    if (committed && committed.size > 4 * READ_MAX) {
      return `That file is too large for a proposed change (${committed.size} bytes); the teacher edits it in the editor instead.`;
    }
    if (content.length > max) {
      return `Too large: at most ${max} bytes per file (got ${content.length}).`;
    }
    if ((cost ?? content.length) > this.writeBudget) {
      return "The request's write budget is used up; summarize what else to change instead.";
    }
    if (
      this.overlay.size + this.deletes.size >= CHANGE_LIMIT &&
      !this.overlay.has(path) &&
      !this.deletes.has(path)
    ) {
      return `Too many changes for one proposal (at most ${CHANGE_LIMIT} files).`;
    }
    this.writeBudget -= cost ?? content.length;
    const existing = this.overlay.get(path);
    const baseOid = existing?.baseOid ?? this.book.tree.get(path)?.oid ?? null;
    this.overlay.set(path, {
      baseOid,
      // The diff always goes against what the file held when this request
      // first touched it — not against an earlier write of the same request,
      // which would show only the last step of the change.
      oldText: existing?.oldText ?? (await this.oldTextOf(path)),
      newText: content,
    });
    this.deletes.delete(path);
    return `Recorded: ${path} ${baseOid === null ? "created" : "changed"}.`;
  }

  /**
   * Replaces passages of a file's current text (pending writes included)
   * and records the result like write(). Each old text must occur once, so
   * an edit cannot land in the wrong place; an empty one appends.
   */
  async edit(path: string, edits: unknown): Promise<string> {
    if (!Array.isArray(edits) || edits.length === 0) {
      return "edit_file needs `edits`, a list of { old_text, new_text }.";
    }
    if (this.deletes.has(path)) return "That file is deleted in this request.";
    const isPage = path === this.input.pagePath;
    if (!this.overlay.has(path) && !this.book.tree.has(path) && !isPage) {
      return this.missing(path);
    }
    if (!isText(path)) return "Only text files can be edited.";
    if (isPage && this.input.pageText === undefined) {
      return "The open page was sent only as an excerpt, so editing it could lose content. Give the teacher the new text as your answer instead; they insert it where they want it.";
    }
    let text = this.overlay.get(path)?.newText ?? (await this.oldTextOf(path));
    if (text === null) {
      return "That file is too large for a proposed change; the teacher edits it in the editor instead.";
    }
    let cost = 0;
    for (const [i, edit] of edits.entries()) {
      const { old_text: oldText, new_text: newText } = (edit ?? {}) as {
        old_text?: unknown;
        new_text?: unknown;
      };
      const which = edits.length > 1 ? `Edit ${i + 1}: ` : "";
      if (typeof oldText !== "string" || typeof newText !== "string") {
        return `${which}needs old_text and new_text, both strings. Nothing was changed.`;
      }
      cost += newText.length;
      if (oldText === "") {
        text = `${text.replace(/\n*$/, "")}\n\n${newText}`;
        continue;
      }
      const at = text.indexOf(oldText);
      if (at === -1) {
        return `${which}old_text is not in ${path}${i > 0 ? " (after the edits before it)" : ""}; copy it exactly from the file's current text. Nothing was changed.`;
      }
      if (text.indexOf(oldText, at + 1) !== -1) {
        return `${which}old_text occurs more than once in ${path}; include more surrounding lines. Nothing was changed.`;
      }
      text = text.slice(0, at) + newText + text.slice(at + oldText.length);
    }
    if (!text.endsWith("\n")) text += "\n";
    return await this.write(path, text, { max: 4 * READ_MAX, cost });
  }

  async remove(path: string): Promise<string> {
    const recorded = this.overlay.get(path);
    if (recorded) {
      this.overlay.delete(path);
      if (recorded.baseOid !== null) this.deletes.add(path);
      return `Recorded: ${path} deleted.`;
    }
    if (this.deletes.has(path))
      return "That file is already deleted in this request.";
    if (!this.book.tree.has(path))
      return this.missing(path);
    if (this.overlay.size + this.deletes.size >= CHANGE_LIMIT) {
      return `Too many changes for one proposal (at most ${CHANGE_LIMIT} files).`;
    }
    this.deletes.add(path);
    return `Recorded: ${path} deleted.`;
  }

  /** The proposal: overlay and deletes as reviewable, diffed changes. */
  async proposal(): Promise<AiProposedChange[]> {
    const changes: AiProposedChange[] = [];
    for (const [path, change] of this.overlay) {
      changes.push({
        op: "write",
        path,
        oldText: change.oldText,
        newText: change.newText,
        baseOid: change.baseOid,
        diff: "",
      });
    }
    for (const path of this.deletes) {
      const entry = this.book.tree.get(path)!;
      // Only text files small enough to diff ship their content; deleting a
      // large or binary file is still fine, it is just shown without bytes.
      const diffable = isText(path) && entry.size <= 4 * READ_MAX;
      changes.push({
        op: "delete",
        path,
        oldText: diffable
          ? (await readBlob(this.repo, entry.oid)).toString("utf8")
          : "",
        baseOid: entry.oid,
        diff: diffable
          ? ""
          : "(not text, or too large to show — the file is deleted)",
      });
    }
    for (const change of changes) {
      if (change.op === "write" || change.diff === "") {
        change.diff = await diffChange(change);
      }
    }
    return changes;
  }
}

/** The message pair of a request: who the assistant is, which book, what to do. */
function buildMessages(book: Book, input: AiAssistInput): ChatMessage[] {
  // Pages and configuration first: in a book with many images the first
  // TREE_LIMIT entries should still be the ones the model writes about.
  const files = [...book.tree.values()]
    .sort((a, b) => listingRank(a.path) - listingRank(b.path))
    .slice(0, TREE_LIMIT)
    .sort((a, b) => a.path.localeCompare(b.path));
  // Static text first, per-book text after it: providers that cache a
  // request's prefix then reuse the biggest part across requests.
  const system: string[] = [SYSTEM_PROMPT];
  system.push(
    [
      "## The book you are working on",
      "",
      `- Name: ${book.name || "(unnamed)"}`,
      `- Language: ${book.language}`,
      "",
      "## Its files",
      "",
      ...(files.length > 0
        ? files.map((f) => `- ${f.path} (${f.size} bytes)`)
        : ["- (the book has no files yet)"]),
      ...(book.tree.size > files.length
        ? [
            `- … and ${book.tree.size - files.length} more; call \`list_files\` for all of them`,
          ]
        : []),
    ].join("\n"),
  );

  const page: string[] = [`## The page: ${input.pagePath}`];
  const inline =
    input.pageText !== undefined && input.pageText.length <= PAGE_INLINE_MAX;
  if (input.pageText !== undefined && !inline) {
    // A big page is not resent with every step; the model reads it on demand.
    page.push(
      "",
      `The page is ${input.pageText.length} bytes, too long to include here. Read it with \`read_files\` when you need the full text.`,
    );
    if (input.context)
      page.push("", "### Its text around the cursor", "", input.context);
  } else if (input.pageText !== undefined) {
    page.push(
      "",
      "### Its full text, as the editor has it now",
      "",
      input.pageText,
    );
  } else if (input.context) {
    page.push("", "### Its text around the cursor", "", input.context);
  }
  if (input.selection)
    page.push("", "### The selected passage", "", input.selection);

  const task = `## The request\n\n${input.prompt}`;

  return [
    { role: "system", content: system.join("\n\n") },
    // The turns before this request, so follow-ups know what came before;
    // they change while the system prefix stays, so prefix caching still
    // applies to the part every request shares.
    ...(input.history ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: [...page, "", task].join("\n") },
  ];
}

/**
 * Runs the assistant for one request and streams what happens: answer text,
 * the tools it uses, the proposal it collected, then how it ended. `signal`
 * aborts the provider call when the reader disconnects. The repository is
 * never written — file changes end as a proposal the teacher reviews.
 */
export async function* runAssistant(
  options: { ai: EffectiveAi; repo: string },
  input: AiAssistInput,
  signal?: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const book = await loadBook(options.repo);
  const tools = new Tools(options.repo, book, input);
  const messages = buildMessages(book, input);
  // The system prompt — static text plus the book's file listing — is the
  // shared prefix of every request and every step, and the listing changes
  // only when the book's head commit does. Keying the prompt cache on that
  // commit makes providers with prefix caching (Mistral bills a cached
  // prefix at 10% of the input price) reuse it across requests.
  const cacheKey = `hyperbook:${book.commit ?? "no-commit"}`;

  let withTools = true;
  let retriedWithoutTools = false;
  let step = 0;
  let finish: "stop" | "length" = "stop";

  // Big read results of earlier rounds, which pruneReads() may drop.
  const rounds: PrunableRead[][] = [];

  while (step < options.ai.maxSteps) {
    pruneReads(messages, rounds, tools);
    let pending: ProviderToolCall[] = [];
    let reported = false;
    let produced = 0;
    try {
      for await (const event of streamChat({
        baseUrl: options.ai.baseUrl,
        apiKey: options.ai.apiKey,
        model: options.ai.model,
        cacheKey,
        messages,
        maxOutputTokens: options.ai.maxOutputTokens,
        timeoutMs: options.ai.timeoutMs,
        tools: withTools ? TOOLS : undefined,
        signal,
      })) {
        if (event.type === "delta") {
          produced += event.text.length;
          yield { type: "delta", text: event.text };
        } else if (event.type === "usage") {
          reported = true;
          yield event;
        } else if (event.type === "tool_calls") {
          pending = event.calls;
          produced += event.calls.reduce(
            (n, call) => n + call.args.length + call.name.length,
            0,
          );
        } else if (event.finish === "length") {
          finish = "length";
        }
      }
    } catch (error) {
      // A provider that does not understand tools (small local models) gets
      // one retry without them; the assistant is then degraded but works.
      // Only a 400 says "your request is malformed" — a 401/403 (bad key)
      // would fail the same way again, so it is reported right away.
      const status = (error as { status?: number }).status;
      if (withTools && !retriedWithoutTools && status === 400) {
        withTools = false;
        retriedWithoutTools = true;
        continue;
      }
      throw error;
    }
    // A provider that reports no usage is metered by an estimate (about
    // four characters a token), so the quota still means something.
    if (!reported) {
      yield {
        type: "usage",
        promptTokens: Math.ceil(JSON.stringify(messages).length / 4),
        // An estimate cannot know which prefix the provider cached.
        cachedPromptTokens: 0,
        completionTokens: Math.ceil(produced / 4),
      };
    }
    step++;
    if (pending.length === 0 || finish === "length") break;

    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pending.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.args },
      })),
    });
    const round: PrunableRead[] = [];
    rounds.push(round);
    for (const call of pending) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.args || "{}") as Record<string, unknown>;
      } catch {
        // A call without JSON arguments: the tool reports what it needs.
      }
      yield { type: "tool", name: call.name, args };
      const content = await answer(tools, call, args);
      const keys = readKeys(call.name, args);
      if (keys.length > 0 && content.length > PRUNE_MIN) {
        round.push({
          index: messages.length,
          id: call.id,
          name: call.name,
          keys,
        });
      }
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }

  const changes = await tools.proposal();
  if (changes.length > 0) yield { type: "proposal", changes };
  yield { type: "done", finish };
}

/** Where a path goes in the prompt's listing: pages and config first. */
function listingRank(path: string): number {
  if (path.endsWith(".md") || !path.includes("/")) return 0;
  return isText(path) ? 1 : 2;
}

type PrunableRead = { index: number; id: string; name: string; keys: string[] };

/** The files or docs a read call hands over, as `Tools` remembers them. */
function readKeys(name: string, args: Record<string, unknown>): string[] {
  if (name === "read_file" && typeof args.path === "string")
    return [`file:${args.path}`];
  if (name === "read_files" && Array.isArray(args.paths))
    return args.paths
      .filter((p): p is string => typeof p === "string")
      .map((p) => `file:${p}`);
  if (name === "read_docs" && typeof args.name === "string") {
    const key = documentationKey(args.name);
    return key ? [`docs:${key}`] : [];
  }
  if (
    name === "rename_file" &&
    typeof args.path === "string" &&
    typeof args.newPath === "string"
  )
    return [`file:${args.path}`, `file:${args.newPath}`];
  return [];
}

/**
 * Every step resends the whole history, so a 30 KB file read in step 1 is
 * paid for again in each later step. Reads older than KEEP_ROUNDS tool rounds
 * are replaced by a stub, and may be read again if the model still needs them.
 */
function pruneReads(
  messages: ChatMessage[],
  rounds: PrunableRead[][],
  tools: Tools,
): void {
  for (const round of rounds.splice(0, Math.max(0, rounds.length - KEEP_ROUNDS))) {
    for (const read of round) {
      const what = read.keys.map((k) => k.slice(k.indexOf(":") + 1)).join(", ");
      messages[read.index] = {
        role: "tool",
        tool_call_id: read.id,
        content: `(The result of ${read.name} for ${what} was dropped to save tokens. Call it again if you still need it.)`,
      };
      for (const key of read.keys) tools.forget(key);
    }
  }
}

/** Answers one tool call; changing tools record onto the overlay. */
async function answer(
  tools: Tools,
  call: ProviderToolCall,
  args: Record<string, unknown>,
): Promise<string> {
  const path =
    typeof args.path === "string" && !bookPathProblem(args.path)
      ? args.path
      : null;
  switch (call.name) {
    case "list_files":
      return tools.listing();
    case "read_file":
      return path
        ? await tools.readOnce(path)
        : "read_file needs a valid `path`.";
    case "read_files":
      return await tools.readMany(args.paths);
    case "read_docs": {
      const key =
        typeof args.name === "string" ? documentationKey(args.name) : null;
      if (!key)
        return `read_docs needs a \`name\` of: ${Object.keys(DOCUMENTATION).join(", ")}.`;
      if (!tools.firstTime(`docs:${key}`))
        return "Already fetched earlier in this conversation; see that result above.";
      return (
        readDocumentation(key) ??
        `The ${key} documentation could not be fetched right now.`
      );
    }
    case "edit_file":
      return path
        ? await tools.edit(path, args.edits)
        : "edit_file needs a valid `path`.";
    case "write_file":
      return path
        ? await tools.write(path, args.content)
        : "write_file needs a valid `path`.";
    case "delete_file":
      return path
        ? await tools.remove(path)
        : "delete_file needs a valid `path`.";
    case "search_files":
      return await tools.search(args.pattern, args.pathPrefix);
    case "rename_file":
      return path && typeof args.newPath === "string" && !bookPathProblem(args.newPath)
        ? await tools.rename(path, args.newPath)
        : "rename_file needs a valid `path` and `newPath`.";
    default:
      return `There is no tool "${call.name}". Use ${TOOLS.map((tool) => tool.name).join(", ")}.`;
  }
}
