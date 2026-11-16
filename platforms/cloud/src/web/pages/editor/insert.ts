import { type Completion, type CompletionContext, type CompletionResult, snippet } from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import i18next from "i18next";
import { type Block, findBlocks } from "./blocks";
import { DIRECTIVES, type Directive } from "./directives";

/*
 * "Insert element": the elements of a page by what they do ("Quiz", "Hint",
 * "Python you can run"), for teachers who do not know their names yet. The
 * Insert dialog and the "/" menu at the start of a line both list them.
 */

export type InsertGroup = "text" | "tasks" | "media" | "code" | "diagrams" | "navigation";
export const INSERT_GROUPS: readonly InsertGroup[] = ["text", "tasks", "media", "code", "diagrams", "navigation"];

export type InsertItem = {
  /** Key of its name and description under editor.insert.items. */
  id: string;
  group: InsertGroup;
  /** The element it inserts. */
  directive: string;
  /**
   * Text that is no element: a code fence the build turns into one, like
   * sheet music's ```abcjs. In CodeMirror snippet syntax, on lines of its own.
   */
  fence?: () => string;
  /**
   * What goes after the colons instead of the element's own snippet, in
   * CodeMirror snippet syntax; a function to put the reader's language in.
   */
  snippet?: () => string;
  /**
   * An element kept in a file of its own, made next to the page and opened in
   * its editor: the file's name ("drawing.excalidraw") and the directive's
   * further attributes.
   */
  file?: { name: string; attributes?: string };
  /** Written in the page, then opened in its visual editor (a structogram). */
  visual?: boolean;
  /** An image from the computer, uploaded next to the page. */
  upload?: boolean;
};

const sample = (key: string) => i18next.t(`editor.insert.sample.${key}`);

export const INSERT_ITEMS: readonly InsertItem[] = [
  // Text and boxes
  { id: "infoBox", group: "text", directive: "alert", snippet: () => `alert{info}\n\${${sample("text")}}\n:::` },
  { id: "warningBox", group: "text", directive: "alert", snippet: () => `alert{warn}\n\${${sample("text")}}\n:::` },
  {
    id: "hint",
    group: "text",
    directive: "collapsible",
    snippet: () => `collapsible{title="\${${sample("hint")}}"}\n\${${sample("text")}}\n:::`,
  },
  {
    id: "tabs",
    group: "text",
    directive: "tabs",
    snippet: () =>
      `:tabs\n:::tab{title="\${${sample("first")}}"}\n\${${sample("text")}}\n:::\n:::tab{title="\${${sample("second")}}"}\n\${${sample("text")}}\n:::\n::::`,
  },
  {
    id: "protect",
    group: "text",
    directive: "protect",
    snippet: () => `protect{password="\${password}"}\n\${${sample("solution")}}\n:::`,
  },
  { id: "term", group: "text", directive: "term" },
  // Tasks and quizzes
  {
    id: "quiz",
    group: "tasks",
    directive: "multievent",
    // The {t{…}} syntax stays out of the catalog, where it would be interpolated.
    snippet: () =>
      `multievent\n\${${sample("quizGap")}} {t{${sample("quizGapAnswer")}}}.\n\n${sample("quizChoice")}\n{c{!2}}   {c{!3}}   {c{4}}   {c{!5}}\n:::`,
  },
  { id: "answerField", group: "tasks", directive: "textinput", snippet: () => `textinput{placeholder="\${${sample("answer")}}"}` },
  { id: "taskFlow", group: "tasks", directive: "bitflow", file: { name: "quiz.bitflow", attributes: ' height="600px"' } },
  { id: "learningMap", group: "tasks", directive: "learningmap", file: { name: "map.learningmap", attributes: ' height="600px"' } },
  // Pictures and media
  { id: "image", group: "media", directive: "slideshow", upload: true },
  { id: "gallery", group: "media", directive: "slideshow" },
  { id: "video", group: "media", directive: "video" },
  { id: "youtube", group: "media", directive: "youtube" },
  { id: "audio", group: "media", directive: "audio" },
  { id: "pdf", group: "media", directive: "pdf" },
  { id: "download", group: "media", directive: "download" },
  { id: "webPage", group: "media", directive: "embed" },
  { id: "qr", group: "media", directive: "qr" },
  // Code you can run
  { id: "python", group: "code", directive: "pyide" },
  { id: "java", group: "code", directive: "onlineide" },
  { id: "web", group: "code", directive: "webide" },
  { id: "p5", group: "code", directive: "p5" },
  { id: "sql", group: "code", directive: "sqlide" },
  { id: "scratch", group: "code", directive: "blockflow-player", file: { name: "project.sb3" } },
  { id: "openscad", group: "code", directive: "openscad" },
  { id: "typst", group: "code", directive: "typst" },
  // Drawings and diagrams
  { id: "drawing", group: "diagrams", directive: "excalidraw", file: { name: "drawing.excalidraw" } },
  { id: "structogram", group: "diagrams", directive: "struktolab", visual: true },
  { id: "diagram", group: "diagrams", directive: "mermaid" },
  { id: "uml", group: "diagrams", directive: "plantuml" },
  { id: "memory", group: "diagrams", directive: "jmp", file: { name: "memory.jmp", attributes: ' height="600px"' } },
  { id: "geogebra", group: "diagrams", directive: "geogebra" },
  // Sheet music is a code fence of its own, ```abcjs, not a directive.
  { id: "music", group: "diagrams", directive: "abcjs", fence: () => "```abcjs\n${X:1}\nK:C\nCDEF GABc|\n```" },
  { id: "scratchBlocks", group: "diagrams", directive: "scratchblock" },
  // Navigation
  { id: "tiles", group: "navigation", directive: "tiles" },
  { id: "pageList", group: "navigation", directive: "pagelist" },
];

export const itemLabel = (item: InsertItem) => i18next.t(`editor.insert.items.${item.id}.label`);
export const itemDescription = (item: InsertItem) => i18next.t(`editor.insert.items.${item.id}.description`);
export const groupLabel = (group: InsertGroup) => i18next.t(`editor.insert.groups.${group}`);

const directiveOf = (item: InsertItem): Directive => DIRECTIVES.find((d) => d.name === item.directive)!;

/** Whether the item goes within a line (`:t[…]`), not on lines of its own. */
export const isInline = (item: InsertItem) => !item.fence && directiveOf(item).kind === "text";

/** The item's text in CodeMirror snippet syntax, colons included; `src` names its file. */
export function itemSnippet(item: InsertItem, src?: string): string {
  if (item.fence) return item.fence();
  const d = directiveOf(item);
  if (item.file && src) return `::${d.name}{src="${src}"${item.file.attributes ?? ""}}`;
  const body = item.snippet?.() ?? d.snippet;
  const fence = d.kind === "text" ? ":" : d.kind === "leaf" ? "::" : ":::";
  return fence + body;
}

/** What the page's editor does for the items it cannot insert as text alone. */
export type InsertHost = {
  /** Asks for an image from the computer, uploaded and linked at from–to. */
  uploadImage: (view: EditorView, from: number, to: number) => void;
  /** Makes the element's file next to the page and opens it; its `src`. */
  createFile: (view: EditorView, item: InsertItem) => string | null;
  /** Opens a block of the page in its visual editor. */
  editBlock: (block: Block, view: EditorView) => void;
};

export const insertHost = Facet.define<InsertHost, InsertHost | null>({ combine: (hosts) => hosts[0] ?? null });

/**
 * Where an element on lines of its own goes for a cursor at from–to: on an
 * empty line in place, otherwise after the line, a blank line between; with a
 * blank line after it too when text follows.
 */
export function blockPlace(view: EditorView, from: number, to: number) {
  const { doc } = view.state;
  const line = doc.lineAt(from);
  const rest = doc.sliceString(line.from, from) + doc.sliceString(to, doc.lineAt(to).to);
  const empty = rest.trim() === "";
  const at = empty ? { from: line.from, to: doc.lineAt(to).to } : { from: doc.lineAt(to).to, to: doc.lineAt(to).to };
  const before = empty ? (line.number > 1 && doc.line(line.number - 1).text.trim() !== "" ? "\n" : "") : "\n\n";
  const lastLine = doc.lineAt(at.to).number;
  const after = lastLine < doc.lines && doc.line(lastLine + 1).text.trim() !== "" ? "\n" : "";
  return { ...at, before, after };
}

/** Inserts `item` into the page for a cursor (or the "/…" typed) at from–to. */
export function insertItem(view: EditorView, item: InsertItem, from: number, to: number) {
  const host = view.state.facet(insertHost);
  if (item.upload) {
    // The "/…" goes; the picture's link takes its place once picked.
    if (from !== to) view.dispatch({ changes: { from, to, insert: "" } });
    host?.uploadImage(view, from, from);
    return;
  }
  if (isInline(item)) {
    snippet(itemSnippet(item))(view, null, from, to);
    view.focus();
    return;
  }
  let src: string | undefined;
  if (item.file) {
    src = host?.createFile(view, item) ?? undefined;
    if (!src) return;
  }
  const place = blockPlace(view, from, to);
  const text = itemSnippet(item, src);
  if (item.file) {
    // No fields to fill: the element's own editor opens.
    const insert = place.before + text + place.after;
    view.dispatch({
      changes: { from: place.from, to: place.to, insert },
      selection: { anchor: place.from + place.before.length + text.length },
      userEvent: "input",
    });
    return;
  }
  snippet(place.before + text + place.after)(view, null, place.from, place.to);
  view.focus();
  if (item.visual && host) {
    const start = place.from + place.before.length;
    const block = findBlocks(view.state.doc.toString()).find(
      (b) => b.type === "inline" && b.from >= start && b.from <= start + text.length,
    );
    if (block) host.editBlock(block, view);
  }
}

/**
 * The "/" menu: at the start of a line, "/" and a few letters list the
 * elements (and formats) whose names match; the "/…" is replaced.
 */
export function slashCompletion({ elements, extra = () => [] }: { elements: boolean; extra?: () => Completion[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const typed = /^[ \t]*(\/[\p{L}\d-]*)$/u.exec(before);
    if (!typed) return null;
    const from = context.pos - typed[1]!.length;
    const items: Completion[] = elements && context.state.facet(insertHost)
      ? INSERT_ITEMS.map((item) => ({
          label: "/" + itemLabel(item),
          displayLabel: itemLabel(item),
          detail: groupLabel(item.group),
          info: itemDescription(item),
          type: "class",
          apply: (view: EditorView, _c: Completion, f: number, t: number) => insertItem(view, item, f, t),
        }))
      : [];
    return { from, options: [...extra(), ...items], validFor: /^\/[\p{L}\d-]*$/u };
  };
}
