// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Code } from "mdast";
import {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import path from "path";
import { VFile } from "vfile";
import { readFile } from "./helper";
import { requestCSS, requestJS } from "./remarkHelper";
import { Element, ElementContent } from "hast";
import { i18n } from "./i18n";
import { icon } from "./icons";

/**
 * The workspace of an IDE directive: the files an author wrote into it.
 *
 * Every IDE reads its content the same way:
 *
 * ````md
 * :::pyide{main="main.py"}
 * ```python file="main.py"
 * ...
 * ```
 * ```python file="test_1.py" role="test" hidden
 * ...
 * ```
 * ::file{path="data.csv" src="/klasse.csv"}
 * :::
 * ````
 *
 * A code block without `file=` in the directive's language is the main file.
 */

export interface WorkspaceFile {
  path: string;
  /** Text files carry their content … */
  content?: string;
  /** … binary files a URL the runtime fetches. */
  url?: string;
  readonly?: boolean;
  hidden?: boolean;
  /**
   * What the file is for, other than being part of the program: a test the
   * reader's code must pass, or the solution (or target image) a drawing is
   * compared with.
   */
  role?: FileRole;
  /** A font a runtime loads (Typst); always hidden. */
  font?: boolean;
}

export type FileRole = "test" | "solution" | "target";
const FILE_ROLES: FileRole[] = ["test", "solution", "target"];
const roleOf = (value: unknown): FileRole | undefined =>
  FILE_ROLES.includes(value as FileRole) ? (value as FileRole) : undefined;
/** A solution or target never shows as a tab, even without `hidden`. */
const isSecretRole = (value: unknown) =>
  value === "solution" || value === "target";

export interface Workspace {
  main: string;
  files: WorkspaceFile[];
}

export interface WorkspaceOptions {
  /** The directive, for messages. */
  name: string;
  /** Code-block languages whose unnamed block is the main file. */
  langs: string[];
  /** The main file when the directive does not name one. */
  defaultMain: string;
}

/** Extensions read as text by `::file`; anything else is fetched as binary. */
const TEXT_EXTENSIONS = new Set([
  ".py",
  ".txt",
  ".csv",
  ".tsv",
  ".json",
  ".md",
  ".xml",
  ".yaml",
  ".yml",
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".svg",
  ".typ",
  ".scad",
]);

export const isTextPath = (p: string) =>
  TEXT_EXTENSIONS.has(path.posix.extname(p).toLowerCase());

/**
 * Parses a code block's meta: `file="a b.py" role=test readonly`.
 * Values may be double-, single- or unquoted; a bare word is a flag.
 */
export const parseCodeMeta = (
  meta: string | null | undefined,
): Record<string, string | true> => {
  const attributes: Record<string, string | true> = {};
  if (!meta) return attributes;
  const pattern = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
  for (const match of meta.matchAll(pattern)) {
    const [, key, double, single, bare] = match;
    attributes[key] = double ?? single ?? bare ?? true;
  }
  return attributes;
};

const KNOWN_META = new Set(["file", "role", "readonly", "hidden"]);

/** A path an author wrote, without the leading slash files may be given with. */
const normalizePath = (p: string) => p.trim().replace(/^\/+/, "");

const isFileDirective = (node: unknown): node is LeafDirective =>
  (node as LeafDirective)?.type === "leafDirective" &&
  (node as LeafDirective).name === "file";

/**
 * Collects the files of an IDE directive.
 *
 * Problems an author can fix -- a duplicate path, a `::file` whose source is
 * missing, a block the IDE cannot place -- are reported as messages on the
 * page and the offending file is left out.
 */
export const collectWorkspace = (
  node: ContainerDirective | LeafDirective | TextDirective,
  file: VFile,
  ctx: HyperbookContext,
  { name, langs, defaultMain }: WorkspaceOptions,
): Workspace => {
  const attributes = node.attributes || {};
  const main =
    typeof attributes.main === "string" && attributes.main.trim()
      ? normalizePath(attributes.main)
      : defaultMain;

  const files: WorkspaceFile[] = [];
  const add = (entry: WorkspaceFile, at: unknown) => {
    if (files.some((f) => f.path === entry.path)) {
      file.message(
        `The ${name} directive has two files named "${entry.path}"; the second is ignored.`,
        at as never,
      );
      return;
    }
    files.push(entry);
  };

  let unnamedMainTaken = false;

  for (const child of node.children || []) {
    if (child.type === "code") {
      const code = child as Code;
      const meta = parseCodeMeta(code.meta);
      let filePath = typeof meta.file === "string" ? normalizePath(meta.file) : "";

      if (!filePath) {
        const unknown = Object.keys(meta).filter((k) => !KNOWN_META.has(k));
        if (unknown.length > 0 || !langs.includes(code.lang || "")) {
          file.message(
            `This code block in the ${name} directive has no file="…" and is ignored.` +
              (unknown.length > 0
                ? ` "${unknown.join(" ")}" is the old syntax; run \`hyperbook migrate\`.`
                : ""),
            code as never,
          );
          continue;
        }
        if (unnamedMainTaken) {
          file.message(
            `Only one code block in the ${name} directive can go without file="…"; this one is ignored.`,
            code as never,
          );
          continue;
        }
        unnamedMainTaken = true;
        filePath = main;
      }

      add(
        {
          path: filePath,
          content: code.value,
          ...(meta.readonly ? { readonly: true } : {}),
          ...(meta.hidden || isSecretRole(meta.role) ? { hidden: true } : {}),
          ...(roleOf(meta.role) ? { role: roleOf(meta.role) } : {}),
        },
        code,
      );
      continue;
    }

    if (isFileDirective(child)) {
      const fileAttributes = child.attributes || {};
      const src = typeof fileAttributes.src === "string" ? fileAttributes.src : "";
      if (!src) {
        file.message(`::file in the ${name} directive needs a src="…".`, child as never);
        continue;
      }
      const filePath = normalizePath(
        typeof fileAttributes.path === "string" && fileAttributes.path
          ? fileAttributes.path
          : path.posix.basename(src),
      );
      const isFont = "font" in fileAttributes;
      const flags = {
        ...("readonly" in fileAttributes ? { readonly: true } : {}),
        ...("hidden" in fileAttributes || isFont || isSecretRole(fileAttributes.role)
          ? { hidden: true }
          : {}),
        ...(isFont ? { font: true } : {}),
        ...(roleOf(fileAttributes.role) ? { role: roleOf(fileAttributes.role) } : {}),
      };

      if (isTextPath(filePath) && !isFont) {
        const content = readFile(src, ctx);
        if (content === null) {
          file.message(
            `::file in the ${name} directive: "${src}" was not found.`,
            child as never,
          );
          continue;
        }
        add({ path: filePath, content, ...flags }, child);
      } else {
        const url = ctx.makeUrl(
          src,
          "public",
          ctx.navigation.current || undefined,
        );
        add({ path: filePath, url, ...flags }, child);
      }
    }
  }

  if (!files.some((f) => f.path === main)) {
    if (files.length > 0) {
      file.message(
        `The ${name} directive has no main file "${main}"; it starts empty.`,
        node as never,
      );
    }
    files.unshift({ path: main, content: "" });
  }

  return { main, files };
};

/** The `data-workspace` attribute: base64 of the UTF-8 JSON. */
export const encodeWorkspace = (workspace: Workspace) =>
  Buffer.from(JSON.stringify(workspace)).toString("base64");

/** An icon button of an IDE's toolbar, labelled for screen readers. */
export const ideIconButton = (
  className: string,
  labelKey: string,
  iconName: Parameters<typeof icon>[0],
): Element => ({
  type: "element",
  tagName: "button",
  properties: {
    class: className,
    title: i18n.get(labelKey),
    "aria-label": i18n.get(labelKey),
  },
  children: [icon(iconName)],
});

/**
 * The bottom toolbar every IDE has, with a directive's own buttons in front.
 * An IDE that downloads its result too (a PDF, a model) shows the download of
 * its files as an archive, so the two are told apart.
 */
export const ideBottomButtons = (
  before: Element[] = [],
  { filesAsArchive = false }: { filesAsArchive?: boolean } = {},
): Element => ({
  type: "element",
  tagName: "div",
  properties: { class: "buttons bottom" },
  children: [
    ...before,
    ideIconButton("reset", "ide-reset", "reset"),
    ideIconButton("copy", "ide-copy", "copy"),
    filesAsArchive
      ? ideIconButton("download", "ide-download-files", "archive")
      : ideIconButton("download", "ide-download", "download"),
    ideIconButton("fullscreen", "ide-fullscreen-enter", "fullscreen"),
  ],
});

/**
 * The head of an IDE's output panel, as tall as the bar above the editor.
 * It holds a title, which a view switch replaces when there is one.
 */
export const idePanelHeader = (
  className: string,
  children: ElementContent[],
): Element => ({
  type: "element",
  tagName: "div",
  properties: {
    class: ["ide-panel-header", className].join(" ").trim(),
  },
  children,
});

/** The title in an output panel's header. */
export const idePanelTitle = (labelKey: string): Element => ({
  type: "element",
  tagName: "span",
  properties: { class: "ide-panel-title" },
  children: [{ type: "text", value: i18n.get(labelKey) }],
});

/** The splitter between an IDE's output and its editor. */
export const ideSplitter = (): Element => ({
  type: "element",
  tagName: "div",
  properties: {
    class: "splitter",
    role: "separator",
    "aria-label": "Resize panels",
  },
  children: [],
});

/** Loads the editor and the IDE shell on the page, in that order. */
export const requestIdeAssets = (file: VFile) => {
  requestJS(file, ["codemirror", "codemirror.bundle.js"]);
  requestJS(file, ["uzip", "uzip.js"]);
  requestJS(file, ["ide", "ide.bundle.js"]);
  requestCSS(file, ["ide", "ide.css"]);
};

export function htmlEntities(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * An IDE's `height` as CSS. Directive attributes are strings, so `height=400`
 * arrives as "400", which CSS ignores without a unit.
 */
export const cssHeight = (height: unknown, fallback = "calc(100dvh - 80px)") => {
  if (height === undefined || height === null || height === "") return fallback;
  const value = String(height).trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
};

export type FileAction = "create" | "upload" | "rename" | "delete";
const FILE_ACTIONS: FileAction[] = ["create", "upload", "rename", "delete"];

/**
 * What readers may do with an IDE's files, from its `files` attribute:
 * `files="create,upload,rename,delete"` in any combination, `files="open"`
 * for all of them, `files="none"` for none. Without the attribute an IDE
 * keeps its defaults.
 *
 * Returns the root attributes the IDE shell reads.
 */
export const fileActionAttributes = (
  node: ContainerDirective | LeafDirective | TextDirective,
  file: VFile,
  {
    name,
    defaults = [],
    accept,
  }: { name: string; defaults?: FileAction[]; accept: string },
): Record<string, string> => {
  const attributes = node.attributes || {};
  const value = attributes.files;
  let actions: FileAction[] = defaults;
  if (typeof value === "string") {
    const words = value
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
    if (words.includes("open")) {
      actions = FILE_ACTIONS;
    } else {
      const unknown = words.filter(
        (word) => word !== "none" && !FILE_ACTIONS.includes(word as FileAction),
      );
      if (unknown.length > 0) {
        file.message(
          `The ${name} directive does not know files="${unknown.join(",")}"; use create, upload, rename, delete or open.`,
          node as never,
        );
      }
      actions = FILE_ACTIONS.filter((action) => words.includes(action));
    }
  }
  return {
    ...(actions.length > 0 ? { "data-files": actions.join(",") } : {}),
    "data-accept":
      typeof attributes.accept === "string" ? attributes.accept : accept,
  };
};

/**
 * Graphic comparison: with `compare`, the reader's drawing is compared with
 * what the `role="solution"` file draws (or a `role="target"` image), and
 * scored like on CSSBattle. `pass=95` sets the score that counts as solved,
 * `frame=60` (p5) the frame compared. The whole picture is compared.
 *
 * Returns the root attributes the IDE's client reads, or none without
 * `compare`.
 */
export const compareAttributes = (
  node: ContainerDirective | LeafDirective | TextDirective,
  file: VFile,
  workspace: Workspace,
  name: string,
): Record<string, string> => {
  const attributes = node.attributes || {};
  if (!("compare" in attributes)) return {};

  const hasSolution = workspace.files.some((f) => f.role === "solution");
  const hasTarget = workspace.files.some((f) => f.role === "target");
  if (!hasSolution && !hasTarget) {
    file.message(
      `The ${name} directive has compare, but no file with role="solution" or role="target" to compare with.`,
      node as never,
    );
    return {};
  }

  const pass = Number(attributes.pass ?? 98);
  const frame = Number(attributes.frame ?? 1);
  return {
    "data-compare": "true",
    "data-pass": String(Number.isFinite(pass) ? Math.min(100, Math.max(0, pass)) : 98),
    ...(Number.isFinite(frame) && frame >= 1
      ? { "data-frame": String(Math.round(frame)) }
      : {}),
  };
};
