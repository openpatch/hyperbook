export const PYODIDE_INDEX_URL = new URL(
  "directive-pyide/pyodide/",
  new URL(HYPERBOOK_ASSETS, document.baseURI),
).href;

export const PYTAMARO_URI_BEGIN = "@@@PYTAMARO_DATA_URI_BEGIN@@@";
export const PYTAMARO_URI_END = "@@@PYTAMARO_DATA_URI_END@@@";

/** Whether a script imports the turtle module, so the canvas and the turtle
 * completions are only activated when they are actually needed. */
export const scriptLooksLikeTurtle = (script) =>
  /\bfrom\s+turtle\s+import\b|\bimport\s+turtle\b/.test(String(script || ""));

/** Whether a script imports pygame, so the canvas is only resized from
 * `set_mode` for scripts that actually draw with SDL. Covers submodules too
 * (`from pygame.locals import *`). */
export const scriptLooksLikePygame = (script) =>
  /\bfrom\s+pygame\b|\bimport\s+pygame\b/.test(String(script || ""));
