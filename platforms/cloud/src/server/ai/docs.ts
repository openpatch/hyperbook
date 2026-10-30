import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * Documentation the assistant retrieves with the read_docs tool: one entry
 * per directive / file format, as a local markdown file (./docs next to this
 * file; the bundle ships them at dist/server/docs via scripts/build-server.mjs).
 * The server never fetches documentation at runtime.
 */

export const DOCUMENTATION = {
  // hyperbook.md is the official https://hyperbook.openpatch.org/llms.txt,
  // vendored locally — the server never fetches documentation at runtime.
  hyperbook: { file: "hyperbook.md" },
  p5: { file: "p5.md" },
  pyide: { file: "pyide.md" },
  webide: { file: "webide.md" },
  onlineide: { file: "onlineide.md" },
  sqlide: { file: "sqlide.md" },
  typst: { file: "typst.md" },
  openscad: { file: "openscad.md" },
  mermaid: { file: "mermaid.md" },
  multievent: { file: "multievent.md" },
  plantuml: { file: "plantuml.md" },
  "abc-music": { file: "abc-music.md" },
  jsxgraph: { file: "jsxgraph.md" },
  bitflow: { file: "bitflow.md" },
  /** The official bitflow llms.txt, vendored. */
  "bitflow-full": { file: "bitflow-llms.txt" },
  blockflow: { file: "blockflow.md" },
  struktolab: { file: "struktolab.md" },
  jmp: { file: "jmp.md" },
  /** The official JMP llms.txt, vendored. */
  "jmp-full": { file: "jmp-llms.txt" },
  excalidraw: { file: "excalidraw.md" },
} as const;

export type DocumentationKey = keyof typeof DOCUMENTATION;

/** Largest documentation text handed to the model, in characters. */
const MAX_DOC_CHARS = 200_000;

const cache = new Map<DocumentationKey, string>();

/** Test hook: empty the in-memory cache. */
export function clearDocumentationCache(): void {
  cache.clear();
}

/**
 * One documentation page as markdown, from the local file (cached).
 * Null when the file is missing — the tool then tells the model so.
 */
export function readDocumentation(key: DocumentationKey): string | null {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const url = new URL(`./docs/${DOCUMENTATION[key].file}`, import.meta.url);
  if (!existsSync(url)) return null;
  const text = readFileSync(fileURLToPath(url), "utf8").slice(0, MAX_DOC_CHARS);
  cache.set(key, text);
  return text;
}
