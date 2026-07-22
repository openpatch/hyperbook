export const PYODIDE_CDN =
  "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js";

export const PYTAMARO_URI_BEGIN = "@@@PYTAMARO_DATA_URI_BEGIN@@@";
export const PYTAMARO_URI_END = "@@@PYTAMARO_DATA_URI_END@@@";

/** Whether a script imports the turtle module, so the canvas and the turtle
 * completions are only activated when they are actually needed. */
export const scriptLooksLikeTurtle = (script) =>
  /\bfrom\s+turtle\s+import\b|\bimport\s+turtle\b/.test(String(script || ""));
