import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { type Action, type Diagnostic, linter } from "@codemirror/lint";
import { type EditorState, type Extension, RangeSetBuilder, StateEffect, StateField, type Text } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  hoverTooltip,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { parse as parseYaml } from "yaml";
import { type Attribute, DIRECTIVES, type Directive, PAGE_DOCS, directive, docsUrl } from "./directives";
import { pageOf } from "./files";
import { findFrontmatter } from "./frontmatter";

/*
 * Writing a page: Markdown with its frontmatter and code blocks highlighted,
 * plus Hyperbook's directives (`:::alert{info}`) highlighted, completed,
 * explained on hover with a link to their documentation, and checked.
 */

// ---- Reading directives ---------------------------------------------------

export type Attr = { name: string; from: number; to: number; value: string | null; valueFrom: number; valueTo: number };

export type DirectiveToken = {
  name: string;
  colons: number;
  /** Positions in the document. */
  from: number;
  nameFrom: number;
  nameTo: number;
  label: { from: number; to: number } | null;
  braces: { from: number; to: number } | null;
  attrs: Attr[];
};

const BLOCK_START = /^[ \t]*(:{2,})([A-Za-z][\w-]*)/;
const CLOSE = /^[ \t]*(:{3,})[ \t]*$/;
const FENCE = /^[ \t]*(`{3,}|~{3,})/;
/** A text directive like `:download[…]{…}`; the label or the braces make it one. */
const INLINE = /(?<![:\w\\]):([A-Za-z][\w-]*)(?=[[{])/g;
const ATTR = /([#.]?[A-Za-z_][\w-]*)(?:[ \t]*=[ \t]*("[^"]*"?|'[^']*'?|[^\s"'}]*))?/g;

/** The `[label]` and `{attributes}` after a directive's name, starting at `at` in `line`. */
function readRest(line: string, at: number, offset: number): Pick<DirectiveToken, "label" | "braces" | "attrs"> {
  let label: DirectiveToken["label"] = null;
  let braces: DirectiveToken["braces"] = null;
  const attrs: Attr[] = [];
  let i = at;
  if (line[i] === "[") {
    let depth = 0;
    let j = i;
    for (; j < line.length; j++) {
      if (line[j] === "\\") j++;
      else if (line[j] === "[") depth++;
      else if (line[j] === "]" && --depth === 0) break;
    }
    label = { from: offset + i, to: offset + Math.min(j + 1, line.length) };
    i = j + 1;
  }
  if (line[i] === "{") {
    const close = line.indexOf("}", i);
    const end = close < 0 ? line.length : close;
    braces = { from: offset + i, to: offset + (close < 0 ? line.length : close + 1) };
    const inner = line.slice(i + 1, end);
    for (const m of inner.matchAll(ATTR)) {
      const from = offset + i + 1 + m.index;
      const raw = m[2];
      const valueFrom = raw === undefined ? from + m[1]!.length : from + m[0].length - raw.length;
      attrs.push({
        name: m[1]!,
        from,
        to: from + m[1]!.length,
        value: raw === undefined ? null : raw.replace(/^["']|["']$/g, ""),
        valueFrom,
        valueTo: valueFrom + (raw?.length ?? 0),
      });
    }
  }
  return { label, braces, attrs };
}

/** The directive a line starts with, like `:::tab{title="A"}`, or null. */
export function blockDirective(line: string, offset = 0): DirectiveToken | null {
  const m = BLOCK_START.exec(line);
  if (!m) return null;
  const nameFrom = m[0].length - m[2]!.length;
  return {
    name: m[2]!,
    colons: m[1]!.length,
    from: offset + m[0].length - m[2]!.length - m[1]!.length,
    nameFrom: offset + nameFrom,
    nameTo: offset + m[0].length,
    ...readRest(line, m[0].length, offset),
  };
}

/** Text directives in a line, like `:t[word]{#entry}`; only known ones, so `:smile:` stays prose. */
export function inlineDirectives(line: string, offset = 0): DirectiveToken[] {
  const out: DirectiveToken[] = [];
  for (const m of line.matchAll(INLINE)) {
    const d = directive(m[1]!);
    if (d?.kind !== "text") continue;
    const nameFrom = m.index + 1;
    out.push({
      name: m[1]!,
      colons: 1,
      from: offset + m.index,
      nameFrom: offset + nameFrom,
      nameTo: offset + nameFrom + m[1]!.length,
      ...readRest(line, nameFrom + m[1]!.length, offset),
    });
  }
  return out;
}

export type Container = { token: DirectiveToken; open: number; close: number | null };

export type Outline = {
  containers: Container[];
  /** Per line (1-based): inside code fences or the frontmatter, where directives are text. */
  verbatim: boolean[];
  /** Per line: how many containers it is in, counting its opening and closing line. */
  depth: number[];
};

/** Where the containers of a page open and close, skipping code and frontmatter. */
export function outline(doc: Text): Outline {
  const containers: Container[] = [];
  const verbatim: boolean[] = [false];
  const depth: number[] = [0];
  const stack: Container[] = [];
  const fm = findFrontmatter(doc.toString());
  const fmEnd = fm ? doc.lineAt(fm.to).number : 0;
  let fence: string | null = null;
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (n <= fmEnd) {
      verbatim.push(true);
      depth.push(0);
      continue;
    }
    const f = FENCE.exec(line.text);
    if (fence !== null) {
      verbatim.push(true);
      depth.push(stack.length);
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length && line.text.trim() === f[1]) fence = null;
      continue;
    }
    if (f) {
      fence = f[1]!;
      verbatim.push(true);
      depth.push(stack.length);
      continue;
    }
    verbatim.push(false);
    const close = CLOSE.exec(line.text);
    if (close) {
      const at = stack.findLastIndex((c) => c.token.colons === close[1]!.length);
      depth.push(stack.length);
      if (at >= 0) {
        for (const c of stack.splice(at)) c.close = n;
      }
      continue;
    }
    const token = blockDirective(line.text, line.from);
    if (token && token.colons >= 3) {
      const c: Container = { token, open: n, close: null };
      containers.push(c);
      stack.push(c);
    }
    depth.push(stack.length);
  }
  return { containers, verbatim, depth };
}

const outlineField = StateField.define<Outline>({
  create: (state) => outline(state.doc),
  update: (value, tr) => (tr.docChanged ? outline(tr.state.doc) : value),
});

/** The containers around line `n`, innermost last. */
function around(state: EditorState, n: number): Container[] {
  return state.field(outlineField).containers.filter((c) => c.open < n && (c.close === null || c.close > n));
}

// ---- Help ------------------------------------------------------------------

function docsLink(href: string, text = "Documentation") {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = `${text} ↗`;
  a.className = "cm-hb-docs";
  return a;
}

function help(d: Directive, attr?: Attribute): HTMLElement {
  const box = document.createElement("div");
  box.className = "cm-hb-help";
  const title = document.createElement("strong");
  title.textContent = attr ? `${attr.name} · ${d.label}` : d.label;
  const text = document.createElement("p");
  text.textContent = attr ? attr.description : d.description;
  box.append(title, text);
  if (attr?.values) {
    const values = document.createElement("p");
    values.textContent = `Values: ${attr.values.join(", ")}`;
    box.append(values);
  }
  if (!attr && d.attributes.length > 0) {
    const list = document.createElement("ul");
    for (const a of d.attributes) {
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = a.name;
      li.append(code, ` ${a.description}`);
      list.append(li);
    }
    box.append(list);
  }
  box.append(docsLink(docsUrl(d)));
  return box;
}

// ---- Completion ------------------------------------------------------------

/** Paths the book's files are addressed by from a page. */
function publicPath(file: string): string | null {
  if (file.startsWith("public/")) return "/" + file.slice("public/".length);
  if (file.startsWith("book/") && !file.endsWith(".md")) return "/" + file.slice("book/".length);
  return null;
}

/**
 * The folder relative links on a page resolve against, as Hyperbook resolves
 * them: the page file's folder ("book/a/b.md" and "book/a/index.md": "/a").
 * Null for other files, like snippets, which resolve on the page they go in.
 */
export function linkBase(file: string): string[] | null {
  if (!file.startsWith("book/") || !pageOf(file)) return null;
  return file.split("/").slice(1, -1);
}

/** The book's address `to` as a relative link from the folder `base`. */
export function relativeTo(base: string[], to: string): string {
  const target = to.split("/").filter(Boolean);
  let common = 0;
  while (common < base.length && base[common] === target[common]) common++;
  const rest = target.slice(common).join("/");
  return common < base.length ? "../".repeat(base.length - common) + rest : `./${rest}`;
}

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function directiveOptions(state: EditorState, line: number, colons: number | null): Completion[] {
  const parents = around(state, line).map((c) => c.token.name);
  return DIRECTIVES.filter((d) => {
    if (colons === null) return d.kind === "text";
    if (d.parents && !d.parents.some((p) => parents.includes(p))) return false;
    return d.kind !== "text";
  }).map((d) => {
    const fence = d.kind === "text" ? ":" : d.kind === "leaf" ? "::" : colons !== null && colons > 3 ? ":".repeat(colons) : ":::";
    const close = fence.length > 3 && d.snippet.endsWith("\n:::") ? "\n" + fence : "\n:::";
    const body = d.kind === "container" && d.snippet.endsWith("\n:::") ? d.snippet.slice(0, -4) + close : d.snippet;
    const name = d.kind === "text" ? (d.aliases?.[0] ?? d.name) : d.name;
    return snippetCompletion(fence + body, {
      label: fence + name,
      displayLabel: name,
      detail: d.label,
      type: d.kind === "container" ? "class" : d.kind === "leaf" ? "function" : "keyword",
      info: () => help(d),
      boost: d.parents ? 10 : 0,
    });
  });
}

function attributeOptions(d: Directive, token: DirectiveToken): Completion[] {
  const used = new Set(token.attrs.map((a) => a.name));
  return d.attributes
    .filter((a) => !used.has(a.name))
    .map((a) =>
      a.flag
        ? { label: a.name, type: "property", detail: a.description, info: () => help(d, a) }
        : snippetCompletion(`${a.name}="\${}"`, { label: a.name, type: "property", detail: a.description, info: () => help(d, a) }),
    );
}

/** A path from the root ("/a/b"), and from the page (`base`) when it has a folder. */
function withRelative(href: string, base: string[] | null, completion: Omit<Completion, "label">): Completion[] {
  return [
    { label: href, ...completion },
    ...(base ? [{ label: relativeTo(base, href), ...completion, detail: completion.detail ? `${completion.detail}, relative` : "relative" }] : []),
  ];
}

function valueOptions(attr: Attribute | undefined, files: string[], base: string[] | null): Completion[] {
  if (!attr) return [];
  if (attr.values) return attr.values.map((v) => ({ label: v, type: "enum" }));
  if (attr.file) {
    return files.flatMap((f) => {
      const p = publicPath(f);
      return p ? withRelative(p, base, { type: "variable" }) : [];
    });
  }
  return [];
}

/**
 * Completion for pages: directives, their attributes and values, and links to
 * the book's files, from the book's root and relative to the page (`path`).
 */
function pageCompletion(files: () => string[], path: () => string) {
  return (context: CompletionContext): CompletionResult | null => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    if (state.field(outlineField).verbatim[line.number]) return null;
    const before = line.text.slice(0, pos - line.from);

    // Inside the braces of a directive: attributes, values, ids.
    const tokens = [blockDirective(line.text, line.from), ...inlineDirectives(line.text, line.from)];
    const token = tokens.find((tk) => tk?.braces && tk.braces.from < pos && (pos < tk.braces.to || !line.text.slice(tk.braces.from - line.from).includes("}")));
    if (token) {
      const d = directive(token.name);
      const inner = state.sliceDoc(token.braces!.from + 1, pos);
      const value = /([\w-]+)[ \t]*=[ \t]*["']?([^"'\s]*)$/.exec(inner);
      if (value) {
        const options = d ? valueOptions(d.attributes.find((a) => a.name === value[1]), files(), linkBase(path())) : [];
        return options.length ? { from: pos - value[2]!.length, options, validFor: /^[^"'\s]*$/ } : null;
      }
      const id = /#([\w./-]*)$/.exec(inner);
      if (id && d && (d.name === "term" || d.name === "snippet")) {
        const folder = d.name === "term" ? "glossary/" : "snippets/";
        const options = files()
          .filter((f) => f.startsWith(folder))
          .map((f) => ({ label: f.slice(folder.length).replace(/(\.md)?(\.hbs)?$/, ""), type: "constant" }));
        return { from: pos - id[1]!.length, options, validFor: /^[\w./-]*$/ };
      }
      const name = /(?:^|\s)([\w-]*)$/.exec(inner);
      if (name && d) return { from: pos - name[1]!.length, options: attributeOptions(d, token), validFor: /^[\w-]*$/ };
      return null;
    }

    // A directive at the start of a line.
    const start = /^[ \t]*(:{1,6})([\w-]*)$/.exec(before);
    if (start) {
      const colons = start[1]!.length;
      // Colons that close an element, where Enter must start a new line.
      const closes = state.field(outlineField).containers.some((c) => c.close === line.number);
      if (closes && start[2] === "" && !context.explicit) return null;
      return {
        from: pos - start[1]!.length - start[2]!.length,
        options: directiveOptions(state, line.number, Math.max(colons, 2)),
        validFor: /^:*[\w-]*$/,
      };
    }

    // A text directive within a line, once a letter follows the colon.
    const inline = /(?<![:\w]):([A-Za-z][\w-]*)$/.exec(before);
    if (inline) return { from: pos - inline[0].length, options: directiveOptions(state, line.number, null), validFor: /^:[\w-]*$/ };

    // A link or image target.
    const link = /(!?)\[[^\]]*\]\(([^)\s]*)$/.exec(before);
    if (link) {
      const all = files();
      const targets: { href: string; detail: string; type: string }[] = link[1]
        ? all.flatMap((f) => {
            const p = publicPath(f);
            return p && IMAGE.test(p) ? [{ href: p, detail: "image", type: "variable" }] : [];
          })
        : all.flatMap((f) => {
            const href = pageOf(f);
            if (href) return [{ href, detail: "page", type: "text" }];
            const p = publicPath(f);
            return p ? [{ href: p, detail: "file", type: "variable" }] : [];
          });
      // Each target from the root ("/a/b") and from this page ("./b", "../b").
      const base = linkBase(path());
      const options: Completion[] = targets.flatMap(({ href, detail, type }) => withRelative(href, base, { detail, type }));
      return { from: pos - link[2]!.length, options, validFor: /^[^)\s]*$/ };
    }
    return null;
  };
}

// ---- Hover -----------------------------------------------------------------

const hoverHelp = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  if (view.state.field(outlineField).verbatim[line.number]) return null;
  for (const token of [blockDirective(line.text, line.from), ...inlineDirectives(line.text, line.from)]) {
    if (!token) continue;
    const d = directive(token.name);
    if (!d) continue;
    if (pos >= token.from && pos <= token.nameTo) {
      return { pos: token.from, end: token.nameTo, above: true, create: () => ({ dom: help(d) }) };
    }
    const attr = token.attrs.find((a) => pos >= a.from && pos <= a.to);
    const known = attr && d.attributes.find((a) => a.name === attr.name);
    if (attr && known) return { pos: attr.from, end: attr.to, above: true, create: () => ({ dom: help(d, known) }) };
  }
  return null;
});

// ---- Checks ----------------------------------------------------------------

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

function closest(name: string): string | null {
  let best: string | null = null;
  let score = 3;
  for (const d of DIRECTIVES) {
    const s = distance(name.toLowerCase(), d.name);
    if (s < score) [best, score] = [d.name, s];
  }
  return best;
}

const check = linter((view) => {
  const { state } = view;
  const { containers, verbatim } = state.field(outlineField);
  const out: Diagnostic[] = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    if (verbatim[n]) continue;
    const line = state.doc.line(n);
    const token = blockDirective(line.text, line.from);
    if (!token) continue;
    const d = directive(token.name);
    if (!d) {
      const fix = closest(token.name);
      const actions: Action[] = fix
        ? [{ name: `Change to ${fix}`, apply: (v, from, to) => v.dispatch({ changes: { from, to, insert: fix } }) }]
        : [];
      out.push({ from: token.nameFrom, to: token.nameTo, severity: "error", message: `Hyperbook has no element "${token.name}".${fix ? ` Did you mean "${fix}"?` : ""}`, actions });
      continue;
    }
    // A container with a `src` file can also stand alone with two colons, like `::struktolab{src=…}`.
    const file = token.attrs.some((a) => a.name === "src") && d.attributes.some((k) => k.name === "src" && k.file);
    if (d.kind === "container" && token.colons < 3 && !file) {
      out.push({ from: token.from, to: token.nameTo, severity: "error", message: `${d.label} holds content, so it starts with three colons: :::${d.name} … :::` });
    }
    if (d.parents) {
      const inside = around(state, n).some((c) => d.parents!.includes(c.token.name));
      if (!inside) out.push({ from: token.from, to: token.nameTo, severity: "warning", message: `${token.name} only works inside ${d.parents.join(" or ")}.` });
    }
    // Some elements take many more options than listed (e.g. GeoGebra's).
    if (d.attributes.length > 0 && d.name !== "geogebra" && d.name !== "blockflow-editor") {
      for (const a of token.attrs) {
        if (a.name.startsWith("#") || a.name.startsWith(".") || d.attributes.some((k) => k.name === a.name)) continue;
        out.push({ from: a.from, to: a.to, severity: "info", message: `${d.label} does not know "${a.name}".` });
      }
    }
  }
  for (const c of containers) {
    if (c.close !== null) continue;
    const fence = ":".repeat(c.token.colons);
    out.push({
      from: c.token.from,
      to: c.token.nameTo,
      severity: "error",
      message: `This ${c.token.name} is never closed. End it with a line of ${fence}`,
      actions: [{ name: `Add ${fence} at the end`, apply: (v) => v.dispatch({ changes: { from: v.state.doc.length, insert: `\n${fence}\n` } }) }],
    });
  }
  // A container inside another needs fewer colons, or it closes the outer one.
  for (const c of containers) {
    const parent = containers.find((p) => p !== c && p.open < c.open && p.close !== null && p.close > c.open);
    if (parent && c.close !== null && c.close > parent.close!) {
      out.push({
        from: parent.token.from,
        to: parent.token.nameTo,
        severity: "warning",
        message: `${parent.token.name} contains ${c.token.name}, so it needs more colons than it (e.g. ${":".repeat(c.token.colons + 1)}${parent.token.name}).`,
      });
    }
  }
  return out;
});

// ---- Highlighting ----------------------------------------------------------

const mark = {
  colons: Decoration.mark({ class: "cm-hb-colons" }),
  name: Decoration.mark({ class: "cm-hb-name" }),
  label: Decoration.mark({ class: "cm-hb-label" }),
  punct: Decoration.mark({ class: "cm-hb-punct" }),
  attr: Decoration.mark({ class: "cm-hb-attr" }),
  value: Decoration.mark({ class: "cm-hb-value" }),
  gap: Decoration.mark({ class: "cm-hb-gap" }),
  inside: Decoration.line({ class: "cm-hb-inside" }),
};

function highlightToken(add: (from: number, to: number, d: Decoration) => void, token: DirectiveToken) {
  add(token.from, token.nameFrom, mark.colons);
  add(token.nameFrom, token.nameTo, mark.name);
  if (token.label) add(token.label.from, token.label.to, mark.label);
  if (token.braces) {
    add(token.braces.from, token.braces.from + 1, mark.punct);
    for (const a of token.attrs) {
      add(a.from, a.to, mark.attr);
      if (a.value !== null && a.valueTo > a.valueFrom) add(a.valueFrom, a.valueTo, mark.value);
    }
    const end = token.braces.to - 1;
    if (end > token.braces.from) add(end, end + 1, mark.punct);
  }
}

const MULTIEVENT_GAP = /\{[A-Za-z]?\{[^}\n]*\}\}/g;

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  const { verbatim, depth, containers } = state.field(outlineField);
  const builder = new RangeSetBuilder<Decoration>();
  const multievent = containers.filter((c) => c.token.name === "multievent");
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      const marks: [number, number, Decoration][] = [];
      const add = (a: number, b: number, d: Decoration) => b > a && marks.push([a, b, d]);
      if (depth[line.number]! > 0) builder.add(line.from, line.from, mark.inside);
      if (!verbatim[line.number]) {
        const block = blockDirective(line.text, line.from);
        if (block) highlightToken(add, block);
        else {
          const close = CLOSE.exec(line.text);
          if (close) add(line.from + line.text.indexOf(":"), line.to, mark.colons);
        }
        for (const token of inlineDirectives(line.text, line.from)) highlightToken(add, token);
        if (multievent.some((c) => c.open < line.number && (c.close ?? Infinity) > line.number)) {
          for (const m of line.text.matchAll(MULTIEVENT_GAP)) add(line.from + m.index, line.from + m.index + m[0].length, mark.gap);
        }
      }
      marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let last = -1;
      for (const [a, b, d] of marks) {
        if (a < last) continue;
        builder.add(a, b, d);
        last = b;
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const directiveHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = decorate(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Colors from app.css, which switch with light and dark mode. */
const highlightStyle = HighlightStyle.define([
  { tag: t.heading, color: "var(--hl-heading)", fontWeight: "bold" },
  { tag: t.heading1, fontSize: "1.25em" },
  { tag: t.heading2, fontSize: "1.12em" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--hl-link)" },
  { tag: t.link, textDecoration: "underline" },
  { tag: t.monospace, color: "var(--hl-string)" },
  { tag: t.quote, color: "var(--hl-muted)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.contentSeparator, t.list], color: "var(--hl-muted)" },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword], color: "var(--hl-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--hl-string)" },
  { tag: [t.number, t.bool, t.atom, t.null], color: "var(--hl-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--hl-muted)", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--hl-type)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: "var(--hl-function)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--hl-property)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--hl-keyword)" },
  { tag: [t.meta, t.documentMeta, t.annotation], color: "var(--hl-muted)" },
  { tag: t.invalid, color: "var(--hl-error)" },
]);

const pageTheme = EditorView.baseTheme({
  ".cm-hb-colons, .cm-hb-punct": { color: "var(--hl-muted)", fontWeight: "bold" },
  ".cm-hb-name": { color: "var(--hl-directive)", fontWeight: "bold" },
  ".cm-hb-label": { color: "var(--hl-heading)" },
  ".cm-hb-attr": { color: "var(--hl-property)" },
  ".cm-hb-value": { color: "var(--hl-string)" },
  ".cm-hb-gap": { backgroundColor: "color-mix(in srgb, var(--hl-directive) 14%, transparent)", borderRadius: "3px" },
  ".cm-hb-inside": { boxShadow: "inset 3px 0 0 color-mix(in srgb, var(--hl-directive) 35%, transparent)" },
  ".cm-hb-help": { maxWidth: "420px", padding: "6px 10px", fontFamily: "var(--font-body, sans-serif)", fontSize: "13px", lineHeight: "1.4" },
  ".cm-hb-help p": { margin: "4px 0" },
  ".cm-hb-help ul": { margin: "4px 0", paddingLeft: "16px", maxHeight: "180px", overflowY: "auto" },
  ".cm-hb-help code": { fontFamily: "var(--font-code, monospace)" },
  ".cm-hb-docs": { color: "var(--hl-link)", textDecoration: "underline" },
  ".cm-completionInfo .cm-hb-help": { padding: "0" },
  ".cm-hb-frontmatter": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 8px",
    // Pulls the bar up against the top of the editor, so its border fits the
    // editor's edge instead of floating inside it (.cm-content's padding).
    margin: "-4px 0 0",
    borderBottom: "1px solid var(--color-nav-border)",
    backgroundColor: "var(--color-nav)",
    fontFamily: "var(--font-body, sans-serif)",
    fontSize: "13px",
  },
  ".cm-hb-frontmatter span": { flex: "1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  ".cm-hb-frontmatter button": {
    padding: "0 8px",
    font: "inherit",
    color: "var(--color-brand)",
    background: "transparent",
    border: "1px solid var(--color-brand)",
    borderRadius: "4px",
    cursor: "pointer",
  },
});

// ---- Frontmatter -----------------------------------------------------------

const toggleYaml = StateEffect.define<boolean>();

class FrontmatterWidget extends WidgetType {
  constructor(
    readonly summary: string,
    readonly folded: boolean,
    readonly onEdit: (view: EditorView) => void,
  ) {
    super();
  }
  eq(other: FrontmatterWidget) {
    return other.summary === this.summary && other.folded === this.folded;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("div");
    box.className = "cm-hb-frontmatter";
    const text = document.createElement("span");
    text.textContent = this.summary;
    const button = (label: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", run);
      return b;
    };
    box.append(
      text,
      button("Edit", () => this.onEdit(view)),
      button(this.folded ? "Show YAML" : "Hide YAML", () => view.dispatch({ effects: toggleYaml.of(!this.folded) })),
      docsLink(PAGE_DOCS, "Help"),
    );
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

function summary(yaml: string): string {
  try {
    const data = parseYaml(yaml) as Record<string, unknown> | null;
    const name = data?.name ?? data?.title;
    const rest = Object.keys(data ?? {}).filter((k) => k !== "name" && k !== "title");
    return `Page settings${typeof name === "string" ? `: ${name}` : ""}${rest.length ? ` · ${rest.join(", ")}` : ""}`;
  } catch {
    return "Page settings (the YAML has an error)";
  }
}

/** The frontmatter as one line with an "Edit" button; "Show YAML" unfolds it. */
function frontmatterFold(onEdit: (view: EditorView) => void): Extension {
  const folded = StateField.define<boolean>({
    create: () => true,
    update: (value, tr) => tr.effects.find((e) => e.is(toggleYaml))?.value ?? value,
  });
  const build = (state: EditorState): DecorationSet => {
    const fm = findFrontmatter(state.doc.toString());
    if (!fm) return Decoration.none;
    const isFolded = state.field(folded);
    const widget = new FrontmatterWidget(summary(fm.yaml), isFolded, onEdit);
    return Decoration.set(
      isFolded
        ? Decoration.replace({ widget, block: true }).range(0, fm.to)
        : Decoration.widget({ widget, block: true, side: -1 }).range(0),
    );
  };
  const decorations = StateField.define<DecorationSet>({
    create: build,
    update: (value, tr) => (tr.docChanged || tr.effects.some((e) => e.is(toggleYaml)) ? build(tr.state) : value),
    provide: (f) => [EditorView.decorations.from(f), EditorView.atomicRanges.of((view) => view.state.field(f))],
  });
  return [folded, decorations];
}

// ---- All together ----------------------------------------------------------

/**
 * Typst code blocks (```typ … ```) in pages; @codemirror/language-data has no
 * Typst, so its Lezer-backed support (no WASM) is described here and loaded
 * only when a page uses it.
 */
const typst = LanguageDescription.of({
  name: "typst",
  alias: ["typ"],
  extensions: ["typ"],
  load: async () => (await import("codemirror-lang-typst/lezer")).typst_lezer(),
});

export function pageLanguage({
  files,
  path,
  onPageSettings,
}: {
  /** The book's files, for links and `src`. */
  files: () => string[];
  /** The file being edited, for relative links; it changes when renamed. */
  path: () => string;
  /** Pages (not snippets): fold the frontmatter, with a button to edit it as a form. */
  onPageSettings?: (view: EditorView) => void;
}): Extension {
  return [
    yamlFrontmatter({ content: markdown({ codeLanguages: [...languages, typst] }) }),
    outlineField,
    syntaxHighlighting(highlightStyle),
    directiveHighlight,
    autocompletion({ override: [pageCompletion(files, path)], icons: false }),
    hoverHelp,
    check,
    pageTheme,
    onPageSettings ? frontmatterFold(onPageSettings) : [],
  ];
}
