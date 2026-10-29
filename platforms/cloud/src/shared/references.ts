/*
 * Finding and rewriting the places a book's files are referenced from, so the
 * editor can tell what a rename, move or delete would break — and update the
 * references when the file moves.
 *
 * What counts as a reference follows what the build does with it (see
 * packages/fs/src/vfile.ts, packages/markdown/src/helper.ts and
 * packages/hyperbook/check.ts):
 *
 * - A link, image or definition addresses a route: pages of book/ and
 *   glossary/ answer at their route (book/section/page.md at /section/page,
 *   an index page at its folder), files of public/, book-public/ and
 *   glossary-public/ at their path below the folder. Relative targets
 *   resolve against the page's own directory; an index page's directory is
 *   its route. A target may carry a page extension and a query or fragment.
 * - A directive attribute whose value names a file (src, poster, db, …)
 *   resolves like readFile in the markdown package: public/<value>, then
 *   book/<value>, then next to the page — with the extension, unlike a
 *   link. The archive directive's name references a folder inside archives/.
 *
 * The scanner is deliberately pragmatic: code blocks are blanked out, and
 * the common link forms are matched with regular expressions rather than a
 * full markdown parse. The positions it reports are what a rewrite relies
 * on, so everything it blanks keeps the text's length.
 */

/** Source extensions the build strips from a page's route. Longest first. */
const PAGE_EXTENSIONS = [".md.hbs", ".md.json", ".md.yml", ".md"];

const IS_PAGE = /^(book|glossary)\/.+\.(md\.hbs|md\.json|md\.yml|md)$/;

/** An URL with a scheme points outside the book; the reader's browser follows it as-is. */
const EXTERNAL = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Directive attributes whose value names a file of the book, by directive
 * name. Keep in step with the `file: true` attributes in
 * src/web/pages/editor/directives.ts — a test asserts the two agree.
 */
export const FILE_DIRECTIVE_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  protect: ["passwordsFile"],
  video: ["src", "poster"],
  audio: ["src", "thumbnail"],
  download: ["src"],
  excalidraw: ["src"],
  learningmap: ["src"],
  bitflow: ["src"],
  jmp: ["src"],
  struktolab: ["src"],
  sqlide: ["db"],
  file: ["src"],
  geogebra: ["src"],
  h5p: ["src", "download-url"],
  "blockflow-player": ["src"],
  "blockflow-editor": ["src", "project"],
  kirimoto: ["model"],
};

export type ReferenceKind = "link" | "image" | "definition" | "directive";

/** One place a file is referenced from. */
export type Reference = {
  /** The page the reference sits in. */
  file: string;
  /** Where the address starts in the page's text, 0-based. */
  start: number;
  /** The length of the address; what a rewrite replaces. */
  length: number;
  /** The address exactly as written, including any query or fragment. */
  raw: string;
  /** 1-based line and column of the address. */
  line: number;
  column: number;
  kind: ReferenceKind;
  /** For directives: which directive and attribute carry the value. */
  directive?: { name: string; attribute: string };
  /** The book file, or archives folder, the reference points at. */
  pointsAt: string;
};

/** A page to scan. */
export type ScannedPage = { path: string; text: string };

/** Folds together the spellings that address the same file. */
export function normalizeHref(href: string): string {
  let out = href.replace(/\/+$/, "");
  if (!out.startsWith("/")) out = `/${out}`;
  for (const extension of PAGE_EXTENSIONS) {
    if (out.endsWith(extension)) {
      out = out.slice(0, -extension.length);
      break;
    }
  }
  if (out.endsWith("/index")) out = out.slice(0, -"/index".length);
  return out || "/";
}

/**
 * The route a page answers to, like the build's hrefs: book/foo.md at /foo,
 * book/section/index.md at /section, glossary/foo.md at /glossary/foo.
 * null when the file is not a page.
 */
export function pageRoute(path: string): string | null {
  const m = /^(book|glossary)\/(.+?)\.(md\.hbs|md\.json|md\.yml|md)$/.exec(path);
  if (!m) return null;
  const segments = m[2]!.split("/");
  if (segments[segments.length - 1] === "index") segments.pop();
  const route = `/${segments.join("/")}`;
  return m[1] === "glossary" ? `/glossary${route === "/" ? "" : route}` : route;
}

/**
 * The address of a file readers can link at: public/, book-public/ and
 * glossary-public/ are served from the output's root, the glossary's public
 * files under /glossary. Pages answer at their route (see pageRoute). Files
 * of archives/ have none — the build only writes a zip for their folder.
 */
export function assetAddress(path: string): string | null {
  const m = /^(public|book-public|glossary-public)\/(.+)$/.exec(path);
  if (!m) return null;
  return m[1] === "glossary-public" ? `/glossary/${m[2]}` : `/${m[2]}`;
}

/** A page's directory inside its own folder ("" when at its root). */
function pageDirectory(page: string): string {
  const m = /^(?:book|glossary)\/(.*)\//.exec(page);
  return m ? m[1]! : "";
}

/** The directory a relative link on this page resolves against. */
function linkBase(page: string): string {
  const route = pageRoute(page);
  if (route === null) return "/";
  // An index page is addressed by its folder, so its links resolve there.
  return /(?:^|\/)index\.(md|md\.hbs|md\.json|md\.yml)$/.test(page) ? route : posixDirname(route);
}

function posixDirname(route: string): string {
  const cut = route.lastIndexOf("/");
  return cut === 0 ? "/" : route.slice(0, cut);
}

/** Joins like the build's candidates: empty segments drop, .. climbs. */
export function joinBookPath(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join("/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/**
 * The book file a directive's attribute value names, found like readFile in
 * the markdown package: in public/, in book/, then next to the page —
 * null when none of them exists.
 */
export function resolveSrc(value: string, page: string, exists: (file: string) => boolean): string | null {
  const dir = pageDirectory(page);
  for (const candidate of [joinBookPath("public", value), joinBookPath("book", value), joinBookPath("book", dir, value)]) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

/**
 * The part of a target before any query or fragment: what must resolve to a
 * file. null when the target is not ours to match (external, a bare fragment).
 */
function addressPart(target: string): string | null {
  if (!target || EXTERNAL.test(target) || target.startsWith("#")) return null;
  const part = target.split("#")[0]!.split("?")[0]!;
  return part || null;
}

/** Inline links, images and definitions, with each match's group positions (the d flag). */
const INLINE = /(!?)\[((?:[^\\\[\]]|\\[\s\S])*)\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/gd;
const DEFINITION = /^ {0,3}\[((?:[^\\\[\]]|\\[\s\S])*)\]:\s*(<[^>]*>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*$/gmd;
/** A directive's opening bracket and its attributes: `::name{…}`, `:::name[label]{…}`. */
const DIRECTIVE_OPEN = /:{2,4}([a-zA-Z][a-zA-Z0-9_-]*)[ \t]*(?:\[[^\]\n]*\])?[ \t]*\{([^}\n]*)\}/gd;
const ATTRIBUTE = /([a-zA-Z][a-zA-Z0-9-]*)[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/gd;

/** Replaces code blocks and spans with spaces of the same length, so the positions of what remains stay true. */
function blankCode(text: string): string {
  const lines = text.split("\n");
  let inFence = false;
  let fence = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const opens = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (opens) {
      const mark = opens[2]![0]!;
      if (!inFence) {
        inFence = true;
        fence = mark;
      } else if (mark === fence) {
        inFence = false;
      }
      lines[i] = line.replace(/[^\n]/g, " ");
      continue;
    }
    if (inFence) lines[i] = line.replace(/[^\n]/g, " ");
  }
  // Inline code spans, also across the lines of one paragraph.
  return lines.join("\n").replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (span) => " ".repeat(span.length));
}

/** 1-based line and column of an offset in a text. */
function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) { line++; last = i; }
  return { line, column: offset - last };
}

/**
 * Every place `target` — a file, or a folder of files — is referenced from in
 * the given pages. `files` are the book's file paths, to resolve against; a
 * reference is only reported when it points at a file under `target`.
 * The archive directive counts as referencing the folder it names.
 */
export function findReferences(pages: ScannedPage[], files: string[], target: string): Reference[] {
  const exists = new Set(files);
  const under = (path: string) => path === target || path.startsWith(`${target}/`);
  const matched = files.filter(under);

  /** Every address a matched file answers at, and which file it is. */
  const byAddress = new Map<string, string>();
  for (const file of matched) {
    const route = pageRoute(file);
    if (route !== null) byAddress.set(normalizeHref(route), file);
    const asset = assetAddress(file);
    if (asset !== null) byAddress.set(normalizeHref(asset), file);
  }
  const references: Reference[] = [];

  for (const page of pages) {
    const text = blankCode(page.text);
    const base = linkBase(page.path);

    /** Resolves a link target the way the build would, and reports it when it points at a matched file. */
    const linkReference = (kind: ReferenceKind, raw: string, start: number): Reference | null => {
      const part = addressPart(raw);
      if (part === null) return null;
      const resolved = part.startsWith("/") ? normalizeHref(part) : normalizeHref(joinBookPath(base, part));
      const file = byAddress.get(resolved);
      if (file === undefined) return null;
      const { line, column } = lineColumn(text, start);
      return { file: page.path, start, length: part.length, raw, line, column, kind, pointsAt: file };
    };

    for (const m of text.matchAll(INLINE)) {
      const written = m[3]!;
      const start = m.indices![3]![0] + (written.startsWith("<") ? 1 : 0);
      const ref = linkReference(m[1] ? "image" : "link", written.replace(/^<|>$/g, ""), start);
      if (ref) references.push(ref);
    }

    for (const m of text.matchAll(DEFINITION)) {
      const written = m[2]!;
      const start = m.indices![2]![0] + (written.startsWith("<") ? 1 : 0);
      const ref = linkReference("definition", written.replace(/^<|>$/g, ""), start);
      if (ref) references.push(ref);
    }

    for (const m of text.matchAll(DIRECTIVE_OPEN)) {
      const name = m[1]!;
      const attrs = m[2]!;
      const attrsStart = m.indices![2]![0];
      const fileAttrs = FILE_DIRECTIVE_ATTRIBUTES[name];

      for (const a of attrs.matchAll(ATTRIBUTE)) {
        const value = a[2] ?? a[3] ?? a[4];
        if (value === undefined || EXTERNAL.test(value)) continue;
        const attr = a[1]!;
        const group = a[2] !== undefined ? 2 : a[3] !== undefined ? 3 : 4;
        const start = attrsStart + a.indices![group]![0];
        const { line, column } = lineColumn(text, start);

        // The archive directive names a folder inside archives/. Deleting or
        // moving any file of the folder changes the zip it downloads.
        if (name === "archive" && attr === "name") {
          const folder = joinBookPath("archives", value);
          const overlaps = under(folder) || target.startsWith(`${folder}/`);
          if (!overlaps) continue;
          references.push({
            file: page.path,
            start,
            length: value.length,
            raw: value,
            line,
            column,
            kind: "directive",
            directive: { name, attribute: attr },
            pointsAt: folder,
          });
          continue;
        }
        if (!fileAttrs?.includes(attr)) continue;
        const file = resolveSrc(value, page.path, (p) => exists.has(p));
        if (file === null || !under(file)) continue;
        references.push({
          file: page.path,
          start,
          length: value.length,
          raw: value,
          line,
          column,
          kind: "directive",
          directive: { name, attribute: attr },
          pointsAt: file,
        });
      }
    }
  }

  references.sort((a, b) => (a.file === b.file ? a.start - b.start : a.file < b.file ? -1 : 1));
  return references;
}

/**
 * The address a reference should carry after its file moved, in the form the
 * build reads; null when the new place has no address — a rewrite skips the
 * reference then. `move` maps the file, or folder, the reference points at
 * to its new path.
 */
export function newTargetOf(ref: Reference, move: (path: string) => string | null): string | null {
  const to = move(ref.pointsAt);
  if (to === null) return null;

  // The archive directive keeps naming its folder, wherever it moves to.
  if (ref.directive?.name === "archive" && ref.directive.attribute === "name") {
    return to.split("/").pop() ?? null;
  }
  // A directive's value is a path below public/ or book/ — with the
  // extension, since readFile looks for the file itself, not its route.
  if (ref.directive) {
    const m = /^(?:public|book)\/(.+)$/.exec(to);
    return m ? `/${m[1]}` : null;
  }
  // A link keeps its query and fragment on the new address.
  const suffix = ref.raw.slice(ref.length);
  const route = pageRoute(to);
  if (route !== null) return route + suffix;
  const asset = assetAddress(to);
  if (asset !== null) return asset + suffix;
  return null;
}

/**
 * Applies new addresses to a page's text: its references, from the back so
 * the positions stay true. References whose new address cannot be written
 * are left alone and returned.
 */
export function rewriteText(
  text: string,
  refs: Reference[],
  move: (path: string) => string | null,
): { text: string; skipped: Reference[] } {
  let out = text;
  const skipped: Reference[] = [];
  for (const ref of [...refs].sort((a, b) => b.start - a.start)) {
    const next = newTargetOf(ref, move);
    if (next === null) {
      skipped.push(ref);
      continue;
    }
    out = out.slice(0, ref.start) + next + out.slice(ref.start + ref.length);
  }
  return { text: out, skipped };
}

/** Whether a path is one of the pages the editor's scan looks at. */
export const isScannedPage = (path: string) => IS_PAGE.test(path);
