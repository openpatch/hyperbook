import { Edit, Note } from "./edits";
import { findAttributeBlock, formatAttributes } from "./directiveAttributes";

/**
 * Rewrites the IDE directives from their old syntax to the workspace syntax
 * (`file="…"` on code blocks, `::file{path src}` for files from the book),
 * keeping what each directive shows and runs exactly as it was.
 *
 * Every rewritten directive gets the id it had before pinned: ids are derived
 * from a directive's content, and readers' saved code is stored under them.
 */

/** The bits of an mdast node the migration reads. */
export interface MdNode {
  type: string;
  name?: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  attributes?: Record<string, string | null | undefined> | null;
  children?: MdNode[];
  position?: {
    start: { line: number; offset?: number };
    end: { line: number; offset?: number };
  };
}

export interface MigrateContext {
  source: string;
  /** The id the directive at this source range had before migrating. */
  oldId: (name: string, start: number, end: number) => string | undefined;
}

/** What a rule wants changed in one directive. */
interface RuleResult {
  /** Attributes to write, when they change. */
  attributes?: Record<string, string | null | undefined>;
  /** Edits inside the directive: code fences, file lines. */
  edits: Edit[];
  /** `::file` lines to add right after the opening line. */
  fileLines: string[];
  notes: Note[];
  /** Leave the directive alone, e.g. because it cannot be converted safely. */
  skip?: boolean;
}

interface Rule {
  /** Pin the id even when nothing else changes, because the id's derivation changed. */
  alwaysPin?: boolean;
  /** Whether readers' saved data is worth keeping (a pinned id). */
  pin: boolean;
  migrate: (node: MdNode, source: string) => RuleResult;
}

const offsetsOf = (node: MdNode) => ({
  start: node.position?.start.offset,
  end: node.position?.end.offset,
  line: node.position?.start.line,
});

/** A code block already in the workspace syntax. */
const isNamed = (code: MdNode) => /(^|\s)file\s*=/.test(code.meta || "");

const codeChildren = (node: MdNode) =>
  (node.children || []).filter((child) => child.type === "code");

/** Replaces a fenced code block's info string (`python test` → …). */
const fenceInfoEdit = (
  source: string,
  node: MdNode,
  info: string,
): Edit | null => {
  const start = node.position?.start.offset;
  if (start === undefined) return null;
  const match = source.slice(start).match(/^(`{3,}|~{3,})([^\n]*)/);
  if (!match) return null; // an indented code block has no info string
  const infoStart = start + match[1].length;
  return { start: infoStart, end: infoStart + match[2].length, text: info };
};

/** A fence long enough for content that may itself contain backticks. */
const fenceFor = (content: string) => {
  const longest = Math.max(
    2,
    ...[...content.matchAll(/`+/g)].map((m) => m[0].length),
  );
  return "`".repeat(longest + 1);
};

const fileLine = (attributes: Record<string, string>) =>
  `::file${formatAttributes(attributes)}`;

const stripSlash = (path: string) => path.replace(/^\/+/, "");

const AT_LINE =
  /^(\s*)@(file|source|font)\s+(?:dest="([^"]+)"\s+)?src="([^"]+)"\s*$/;

/**
 * Converts one old `@file` / `@source` / `@font` line to a `::file` line, or
 * returns null when the line is not one of the given kinds.
 */
export const convertAtLine = (
  line: string,
  kinds: ("file" | "source" | "font")[] = ["file", "source", "font"],
): string | null => {
  const m = line.match(AT_LINE);
  if (!m || !kinds.includes(m[2] as never)) return null;
  const [, indent, kind, dest, src] = m;
  if (kind === "font") return `${indent}${fileLine({ src, font: "" })}`;
  if (!dest) return null;
  return `${indent}${fileLine({ path: stripSlash(dest), src })}`;
};

/**
 * The old `@file` / `@source` / `@font` lines, which were plain paragraphs
 * inside the directive. Each becomes a `::file` line. A paragraph holding
 * anything else as well is reported and left alone, because a `::file` line
 * inside running text would not be a directive.
 */
const atLines = (
  node: MdNode,
  source: string,
  kinds: ("file" | "source" | "font")[],
): { edits: Edit[]; notes: Note[] } => {
  const edits: Edit[] = [];
  const notes: Note[] = [];

  for (const paragraph of node.children || []) {
    if (paragraph.type !== "paragraph") continue;
    const { start, end, line } = offsetsOf(paragraph);
    if (start === undefined || end === undefined) continue;
    const text = source.slice(start, end);
    if (!/(^|\n)\s*@(file|source|font)\b/.test(text)) continue;

    const converted = text.split("\n").map((l) => convertAtLine(l, kinds));
    if (converted.some((l) => l === null)) {
      notes.push({
        line,
        message:
          "This paragraph mixes @file/@source/@font lines with other text, so it was not converted. Write each file as its own ::file{path=\"…\" src=\"…\"} line.",
      });
      continue;
    }
    edits.push({ start, end, text: converted.join("\n") });
  }
  return { edits, notes };
};

/**
 * Snippets are pasted into IDE directives, so they may hold the old file
 * lines on their own, outside any directive. Converts every such line that is
 * not inside a code fence.
 */
export const convertSnippetAtLines = (
  source: string,
): { text: string; changed: number } => {
  let fence: string | null = null;
  let changed = 0;
  const lines = source.split("\n").map((line) => {
    const opening = line.match(/^\s*(`{3,}|~{3,})/);
    if (opening) {
      if (!fence) fence = opening[1];
      else if (opening[1].startsWith(fence)) fence = null;
      return line;
    }
    if (fence) return line;
    const converted = convertAtLine(line);
    if (converted === null) return line;
    changed += 1;
    return converted;
  });
  return { text: lines.join("\n"), changed };
};

// --- rules --------------------------------------------------------------------

const pyide: Rule = {
  pin: true,
  migrate(node, source) {
    const edits: Edit[] = [];
    const notes: Note[] = [];
    const attributes = { ...(node.attributes || {}) };
    const fileLines: string[] = [];
    const codes = codeChildren(node);

    if (attributes.src) {
      fileLines.push(fileLine({ path: "main.py", src: attributes.src }));
      delete attributes.src;
      if (codes.length > 0) {
        notes.push({
          line: offsetsOf(node).line,
          message:
            'This pyide loads src="…", so its code blocks were never used, tests included. They are still ignored; delete them or move them into the file.',
        });
      }
      return { attributes, edits, fileLines, notes };
    }

    // The old rules exactly: a meta containing "test" anywhere marks a test,
    // the first python block without it is the script, the rest was unused.
    let mainSeen = false;
    let tests = 0;
    for (const code of codes) {
      if (isNamed(code)) continue;
      if (code.meta?.includes("test")) {
        tests += 1;
        const edit = fenceInfoEdit(
          source,
          code,
          `${code.lang || "python"} file="test_${tests}.py" role="test" hidden`,
        );
        if (edit) edits.push(edit);
      } else if (code.lang === "python" && !mainSeen) {
        mainSeen = true;
        if (code.meta?.trim()) {
          const edit = fenceInfoEdit(source, code, `python file="main.py"`);
          if (edit) edits.push(edit);
        }
      } else {
        notes.push({
          line: code.position?.start.line,
          message:
            'This code block was never used by the pyide and still is not. Delete it, or name it with file="…" to make it part of the workspace.',
        });
      }
    }
    return { edits, fileLines, notes };
  },
};

const p5: Rule = {
  // p5 moved from the rehype to the remark stage, which hashes a different
  // node: every p5 changes its id, whatever its syntax.
  alwaysPin: true,
  pin: true,
  migrate(node, source) {
    const edits: Edit[] = [];
    const notes: Note[] = [];
    const attributes = { ...(node.attributes || {}) };
    const fileLines: string[] = [];

    // Already in the new syntax, which the old p5 never knew.
    const isNew =
      "mode" in attributes ||
      codeChildren(node).some(isNamed) ||
      (node.children || []).some(
        (c) => c.type === "leafDirective" && c.name === "file",
      );
    if (isNew) return { edits, fileLines, notes, skip: true };

    if ("editor" in attributes) {
      // The old p5 only showed its editor for editor="true", not a bare flag.
      if (attributes.editor === "true") {
        attributes.mode = "editor";
      }
      delete attributes.editor;
    }
    if (attributes.src) {
      fileLines.push(fileLine({ path: "sketch.js", src: attributes.src }));
      delete attributes.src;
      return { attributes, edits, fileLines, notes };
    }

    // The old p5 ran all text inside the directive as one sketch.
    const others = (node.children || []).filter(
      (c) => c.type !== "code" && !(c.type === "leafDirective" && c.name === "file"),
    );
    const codes = codeChildren(node);
    if (codes.length > 1 && codes.some((c) => !isNamed(c)) || others.length > 0) {
      notes.push({
        line: offsetsOf(node).line,
        message:
          'This p5 ran all of its text as one sketch. Now only the code block without file="…" is the sketch; merge the blocks or name the others with file="….js".',
      });
    }
    const [code] = codes.filter((c) => !isNamed(c));
    if (code && !["js", "javascript"].includes(code.lang || "")) {
      const edit = fenceInfoEdit(source, code, "js");
      if (edit) edits.push(edit);
    } else if (code?.meta?.trim()) {
      const edit = fenceInfoEdit(source, code, `js file="sketch.js"`);
      if (edit) edits.push(edit);
    }
    return { attributes, edits, fileLines, notes };
  },
};

const openscad: Rule = {
  pin: true,
  migrate(node, source) {
    const attributes = { ...(node.attributes || {}) };
    const fileLines: string[] = [];
    const { edits, notes } = atLines(node, source, ["file"]);

    if (attributes.src) {
      fileLines.push(fileLine({ path: "main.scad", src: attributes.src }));
      delete attributes.src;
      return { attributes, edits, fileLines, notes };
    }
    const main = codeChildren(node).find(
      (c) => ["scad", "openscad"].includes(c.lang || "") && !isNamed(c),
    );
    if (main?.meta?.trim()) {
      const edit = fenceInfoEdit(source, main, `${main.lang} file="main.scad"`);
      if (edit) edits.push(edit);
    }
    return { attributes, edits, fileLines, notes };
  },
};

const typst: Rule = {
  pin: true,
  migrate(node, source) {
    const attributes = { ...(node.attributes || {}) };
    const { edits, notes } = atLines(node, source, ["file", "source", "font"]);
    const all = codeChildren(node).filter((c) =>
      ["typ", "typst"].includes(c.lang || ""),
    );
    // Already migrated: the new syntax names files with file="…".
    if (all.some(isNamed)) {
      return { attributes, edits, fileLines: [], notes };
    }
    const codes = all;

    // The old typst took a block's whole meta as its file name; unnamed
    // blocks were main.typ.
    const names = codes.map((c) => c.meta?.trim() || "main.typ");
    let unnamedSeen = false;
    codes.forEach((code, i) => {
      if (!code.meta?.trim()) {
        if (unnamedSeen) {
          notes.push({
            line: code.position?.start.line,
            message:
              'Several code blocks in this typst were all main.typ. Name all but one with file="….typ".',
          });
        }
        unnamedSeen = true;
        return;
      }
      const edit = fenceInfoEdit(source, code, `${code.lang} file="${names[i]}"`);
      if (edit) edits.push(edit);
    });

    // Old main: main.typ, else main.typst, else the first block.
    if (!names.includes("main.typ") && names.length > 0) {
      attributes.main = names.includes("main.typst") ? "main.typst" : names[0];
    }
    return { attributes, edits, fileLines: [], notes };
  },
};

/** The page that used to be a fixed template around the html block. */
const DEFAULT_WEBIDE_TEMPLATE = `<!DOCTYPE html>
<head>
<title>WebIDE</title>
<meta charset="utf8" />
<style type='text/css'>
html, body {
  margin: 0;
  padding: 0;
  background: white;
}
###CSS###
</style>
</head>
<body>###HTML###</body>
<script type="text/javascript">###JS###</script>`;

const webide: Rule = {
  // Nothing was saved worth keeping: no book used the webide.
  pin: false,
  migrate(node, source) {
    const edits: Edit[] = [];
    const notes: Note[] = [];
    const codes = codeChildren(node);
    const html = codes.find((c) => c.lang === "html" && !c.meta);
    const template = codes.find((c) => c.lang === "html" && c.meta === "template");
    const css = codes.find((c) => c.lang === "css");
    const js = codes.find((c) => c.lang === "js");
    if (!html && !template && !css && !js) {
      return { edits, fileLines: [], notes };
    }
    // Already migrated: files are named, or the page is a whole document
    // rather than the fragment the old template wrapped.
    const isDocument = /<!DOCTYPE|<html[\s>]/i.test(html?.value ?? "");
    if (codes.some(isNamed) || (isDocument && !template && !css && !js)) {
      return { edits, fileLines: [], notes };
    }

    let page = template?.value ?? DEFAULT_WEBIDE_TEMPLATE;
    // The CSS went inside the template's <style>, after its own rules. An
    // @import there would be ignored, so link the file right after that tag.
    const cssAt = page.indexOf("###CSS###");
    if (cssAt !== -1) {
      const styleEnd = page.indexOf("</style>", cssAt);
      if (css && styleEnd === -1) {
        notes.push({
          line: offsetsOf(node).line,
          message:
            "The template's ###CSS### is not inside a <style> tag, so this webide was not converted. Link style.css from index.html yourself.",
        });
        return { edits, fileLines: [], notes, skip: true };
      }
      const link = css ? '\n<link rel="stylesheet" href="style.css" />' : "";
      page = styleEnd === -1
        ? page.replace("###CSS###", "")
        : page.slice(0, cssAt) +
        page.slice(cssAt + "###CSS###".length, styleEnd) +
        "</style>" +
        link +
        page.slice(styleEnd + "</style>".length);
    }
    const script = page.match(/<script([^>]*)>\s*###JS###\s*<\/script>/);
    if (script) {
      page = page.replace(script[0], () =>
        js ? `<script${script[1]} src="script.js"></script>` : "",
      );
    } else if (page.includes("###JS###")) {
      notes.push({
        line: offsetsOf(node).line,
        message:
          "The template's ###JS### is not alone in a <script> tag, so this webide was not converted. Link script.js from index.html yourself.",
      });
      return { edits, fileLines: [], notes, skip: true };
    }
    page = page.replace("###HTML###", () => html?.value ?? "");

    const fence = fenceFor(page);
    const block = `${fence}html\n${page}\n${fence}`;
    const target = html ?? template!;
    edits.push({
      start: target.position!.start.offset!,
      end: target.position!.end.offset!,
      text: block,
    });
    if (html && template) {
      edits.push({
        start: template.position!.start.offset!,
        end: template.position!.end.offset!,
        text: "",
      });
    }
    if (css) {
      const edit = fenceInfoEdit(source, css, `css file="style.css"`);
      if (edit) edits.push(edit);
    }
    if (js) {
      const edit = fenceInfoEdit(source, js, `js file="script.js"`);
      if (edit) edits.push(edit);
    }
    return { edits, fileLines: [], notes };
  },
};

export const RULES: Record<string, Rule> = { pyide, p5, openscad, typst, webide };

/**
 * Which directive each `::snippet{#name}` on a page is pasted into ("" when
 * none), so a snippet's old file lines are only converted where they belong
 * to an IDE that changed. The Online IDE reads @file lines too.
 */
export const snippetUses = (tree: MdNode): { name: string; inside: string }[] => {
  const uses: { name: string; inside: string }[] = [];
  const walk = (node: MdNode, inside: string) => {
    if (node.type === "leafDirective" && node.name === "snippet") {
      const name = node.attributes?.id;
      if (name) uses.push({ name, inside });
    }
    const here =
      node.type === "containerDirective" && node.name ? node.name : inside;
    node.children?.forEach((child) => walk(child, here));
  };
  walk(tree, "");
  return uses;
};

/** Collects the directives the rules cover, in document order. */
const findDirectives = (tree: MdNode): MdNode[] => {
  const found: MdNode[] = [];
  const walk = (node: MdNode) => {
    if (
      (node.type === "containerDirective" || node.type === "leafDirective") &&
      node.name &&
      node.name in RULES
    ) {
      found.push(node);
    }
    node.children?.forEach(walk);
  };
  walk(tree);
  return found;
};

export const migrateIdes = (
  tree: MdNode,
  { source, oldId }: MigrateContext,
): { edits: Edit[]; notes: Note[]; migrated: number } => {
  const edits: Edit[] = [];
  const notes: Note[] = [];
  let migrated = 0;

  for (const node of findDirectives(tree)) {
    const name = node.name!;
    const rule = RULES[name];
    const { start, end, line } = offsetsOf(node);
    if (start === undefined || end === undefined) continue;

    const result = rule.migrate(node, source);
    notes.push(...result.notes);
    if (result.skip) continue;
    // An edit that writes what is already there changes nothing.
    result.edits = result.edits.filter(
      (edit) => source.slice(edit.start, edit.end) !== edit.text,
    );

    const before = formatAttributes(node.attributes || {});
    const attributes = { ...(result.attributes ?? node.attributes ?? {}) };
    const changed =
      result.edits.length > 0 ||
      result.fileLines.length > 0 ||
      formatAttributes(attributes) !== before;
    if (!changed && !(rule.alwaysPin && !attributes.id)) continue;

    if (rule.pin && !attributes.id) {
      const id = oldId(name, start, end);
      if (id) {
        attributes.id = id;
      } else {
        notes.push({
          line,
          message: `Could not determine this ${name}'s previous id, so readers' saved work for it will not be found. Pin it with id="…" if you know it.`,
        });
      }
    }
    const ordered = attributes.id ? { id: attributes.id, ...attributes } : attributes;

    const block = findAttributeBlock(source, start, name);
    if (!block) {
      notes.push({
        line,
        message: `Could not read this ${name}'s attributes; it was left as it is.`,
      });
      continue;
    }

    const own: Edit[] = [...result.edits];
    if (node.type === "leafDirective") {
      // A leaf cannot hold the ::file lines, so it becomes a container.
      const colons = source.slice(start).match(/^:+/)![0].length + 1;
      const fence = ":".repeat(Math.max(colons, 3));
      own.push({
        start,
        end,
        text: [`${fence}${name}${formatAttributes(ordered)}`, ...result.fileLines, fence].join("\n"),
      });
    } else {
      own.push({
        start: block.start,
        end: block.end,
        text: formatAttributes(ordered),
      });
      if (result.fileLines.length > 0) {
        const lineEnd = source.indexOf("\n", block.end);
        if (lineEnd !== -1) {
          own.push({
            start: lineEnd + 1,
            end: lineEnd + 1,
            text: result.fileLines.map((l) => `${l}\n`).join(""),
          });
        }
      }
    }

    edits.push(...own);
    migrated += 1;
  }

  return { edits, notes, migrated };
};
