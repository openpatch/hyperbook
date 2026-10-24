/**
 * The file model of an IDE workspace, without any DOM.
 *
 * A page ships its workspace as base64 JSON in `data-workspace` (see
 * src/ideWorkspace.ts). The reader's saved row is merged over it, so the page
 * can keep changing after a learner started working on it.
 */

/**
 * @typedef {import("../assets/hyperbook.types.js").HyperbookIdeFile} IdeFile
 * @typedef {import("../assets/hyperbook.types.js").HyperbookIdeRow} IdeRow
 * @typedef {{ main: string, files: IdeFile[] }} Workspace
 */

/**
 * Decodes the `data-workspace` attribute. The server encodes the UTF-8 bytes,
 * so atob() alone would turn "prüfe" into "prÃ¼fe".
 * @param {string | null} attribute
 * @returns {Workspace}
 */
export const decodeWorkspace = (attribute) => {
  if (!attribute) return { main: "", files: [] };
  const bytes = Uint8Array.from(atob(attribute), (c) => c.charCodeAt(0));
  const workspace = JSON.parse(new TextDecoder().decode(bytes));
  return {
    main: typeof workspace.main === "string" ? workspace.main : "",
    files: Array.isArray(workspace.files) ? workspace.files : [],
  };
};

/**
 * Whether the reader may change a page file, and so whether their version of
 * it is kept. Tests, solutions, helpers marked readonly and hidden files
 * always come from the page, so an author's fix reaches learners who already
 * started.
 * @param {IdeFile} file
 */
export const isEditable = (file) =>
  !file.readonly && !file.hidden && !file.role && !file.url;

/**
 * Merges a saved row over the page's workspace.
 *
 * - an editable page file the reader changed: the reader's version
 * - an editable page file the reader deleted or renamed (listed in
 *   `removed`): left out
 * - any other page file: the page's version
 * - a file only in the row: kept when the reader may add or rename files
 *   (it is theirs), dropped otherwise
 *
 * @param {Workspace} page
 * @param {IdeRow | undefined} saved
 * @param {{ allowCreate?: boolean }} [options]
 * @returns {{ files: IdeFile[], active: string, removed: string[] }}
 */
export const mergeWorkspace = (page, saved, { allowCreate = false } = {}) => {
  const savedByPath = new Map();
  for (const file of saved?.files || []) {
    if (file && typeof file.path === "string") savedByPath.set(file.path, file);
  }
  // Only files the reader could remove count; the page wins otherwise.
  const removed = (Array.isArray(saved?.removed) ? saved.removed : []).filter(
    (path) => {
      const file = page.files.find((f) => f.path === path);
      return file && path !== page.main && isEditable(file);
    },
  );

  const files = [];
  for (const file of page.files) {
    const own = savedByPath.get(file.path);
    if (removed.includes(file.path) && !own) continue;
    savedByPath.delete(file.path);
    if (own && isEditable(file) && typeof own.content === "string") {
      files.push({ ...file, content: own.content });
    } else {
      files.push({ ...file });
    }
  }

  if (allowCreate) {
    for (const own of savedByPath.values()) {
      if (typeof own.content === "string") {
        files.push({ path: own.path, content: own.content, created: true });
      } else if (typeof own.url === "string") {
        files.push({ path: own.path, url: own.url, created: true });
      }
    }
  }

  const visible = (path) =>
    files.some(
      (file) =>
        file.path === path && !file.hidden && typeof file.content === "string",
    );
  const active =
    saved?.active && visible(saved.active) ? saved.active : page.main;

  return { files, active, removed };
};

/**
 * What readers may do with the files, from the `data-files` attribute:
 * "create,upload,rename,delete" in any combination.
 * @param {string | null | undefined} attribute
 */
export const parseFileActions = (attribute) => {
  const actions = new Set(
    (attribute || "")
      .split(",")
      .map((action) => action.trim())
      .filter(Boolean),
  );
  return {
    create: actions.has("create"),
    upload: actions.has("upload"),
    rename: actions.has("rename"),
    delete: actions.has("delete"),
  };
};

/**
 * Whether a reader may rename or delete a file. Their own files always; the
 * page's editable files when the IDE allows it; the main file never.
 * @param {IdeFile} file
 * @param {string} main
 * @param {boolean} allowed The IDE allows renaming (or deleting) page files.
 */
export const mayChange = (file, main, allowed) =>
  file.path !== main && (file.created || (allowed && isEditable(file)));

/**
 * The part of a workspace worth saving: what the reader can change.
 * @param {IdeFile[]} files
 * @returns {IdeFile[]}
 */
export const savableFiles = (files) =>
  files
    .filter((file) => file.created || isEditable(file))
    .map((file) =>
      typeof file.url === "string" && typeof file.content !== "string"
        ? { path: file.path, url: file.url, created: true }
        : {
            path: file.path,
            content: file.content ?? "",
            ...(file.created ? { created: true } : {}),
          },
    );

/** Extensions a reader's upload is read as text for, and shown in a tab. */
const TEXT_EXTENSIONS = [
  ".py", ".txt", ".csv", ".tsv", ".json", ".md", ".xml", ".yaml", ".yml",
  ".html", ".css", ".js", ".mjs", ".svg", ".typ", ".scad",
];

/** @param {string} path */
export const isTextPath = (path) =>
  TEXT_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));

/**
 * Checks a file name a reader typed for a new file.
 * @param {string} path
 * @param {IdeFile[]} files
 * @param {string[]} accept Allowed extensions, e.g. [".py"]. Empty allows any.
 * @param {string | null} [except] A file being renamed, which may keep its name.
 * @returns {"empty" | "invalid" | "extension" | "exists" | null} The problem, or null.
 */
export const checkNewPath = (path, files, accept = [], except = null) => {
  const name = path.trim();
  if (!name) return "empty";
  if (
    name.startsWith("/") ||
    name.endsWith("/") ||
    name.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return "invalid";
  }
  if (accept.length > 0 && !accept.some((ext) => name.endsWith(ext))) {
    return "extension";
  }
  if (files.some((file) => file.path === name && file.path !== except)) {
    return "exists";
  }
  return null;
};
