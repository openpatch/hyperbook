export const CHEERPJ_BASE =
  document
    .querySelector?.(".directive-javaide[data-runtime-url]")
    ?.getAttribute("data-runtime-url") ||
  new URL(
    "directive-javaide/cheerpj/",
    new URL(HYPERBOOK_ASSETS, document.baseURI),
  ).href;

export const CHEERPJ_LOADER_URL = new URL("loader.js", CHEERPJ_BASE).href;

export const WORKER_URL = new URL(
  "directive-javaide/worker.js",
  new URL(HYPERBOOK_ASSETS, document.baseURI),
).href;

/** The Java class a source file provides: its file name without .java. */
export const classNameOf = (path) =>
  String(path)
    .split("/")
    .pop()
    .replace(/\.java$/i, "")
    .replace(/[^A-Za-z0-9_$]/g, "_");
