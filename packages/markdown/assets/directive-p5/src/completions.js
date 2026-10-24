import { P5_GLOBALS, P5_VECTOR } from "./p5-api.js";

/**
 * Editor completions for p5: every global function, system variable and
 * constant of the bundled p5, and p5.Vector's members after a vector's dot.
 * The list is generated from p5's type definitions (see p5-api.js).
 */

// Constants rank below functions and variables, so `C` offers circle()
// before CENTER and CHORD.
const BOOST = { function: 1, variable: 1, method: 1, property: 1, constant: -1 };

const toOptions = (entries) =>
  entries.map(([label, detail, info, type]) => ({
    label,
    type,
    ...(detail !== label ? { detail } : {}),
    ...(info ? { info } : {}),
    boost: BOOST[type] ?? 0,
  }));

/**
 * Names that are vectors: `v = createVector(…)`, `pos = p5.Vector.add(…)`,
 * or `this.pos = createVector(…)`, which `pos.` then completes.
 */
const VECTOR_PATTERN =
  /([A-Za-z_$][\w$]*)\s*=\s*(?:createVector|p5\s*\.\s*Vector\s*\.\s*\w+)\s*\(/g;

const memberBases = (doc) => {
  const bases = [];
  for (const match of doc.matchAll(VECTOR_PATTERN)) {
    if (!bases.includes(match[1])) bases.push(match[1]);
  }
  return bases;
};

/** @type {import("../../../codemirror-bundle/index.js").CompletionSpec} */
export const p5Completions = {
  globals: toOptions(P5_GLOBALS),
  members: toOptions(P5_VECTOR),
  memberBases,
};
