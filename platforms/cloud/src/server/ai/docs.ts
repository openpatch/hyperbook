import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * Documentation the assistant retrieves with the read_docs tool: one topic
 * per directive / file format / part of the format, from local files (./docs
 * next to this file; the bundle ships them at dist/server/docs via
 * scripts/build-server.mjs). The server never fetches documentation at runtime.
 *
 * hyperbook.md is the official https://hyperbook.openpatch.org/llms.txt,
 * vendored locally. It is 350 KB — mostly changelog and an emoji cheat sheet —
 * so it is never handed over whole: each topic gets the sections it names.
 * A topic with a curated file (written for the model: short, with the
 * conventions that trip models up) gets that first, the official section
 * after it as the attribute reference.
 */

type Topic = {
  /** A curated file in ./docs. */
  file?: string;
  /** Titles of sections of hyperbook.md (its top-level `# Title`s). */
  sections?: string[];
};

export const DOCUMENTATION = {
  markdown: {
    sections: [
      "Checklist",
      "Code",
      "Comment",
      "Emphasis",
      "Footnote",
      "Header",
      "Stable H1 {#stable}",
      "Horizontal Rule",
      "Image",
      "Line Break",
      "Link",
      "List",
      "Quote",
      "Sub- and Superscript",
      "Table",
      "Math",
    ],
  },
  "page-config": { sections: ["Page Configuration", "Section Configuration"] },
  "book-config": { sections: ["Book Configuration"] },
  "library-config": { sections: ["Library Configuration"] },
  glossary: { sections: ["Glossary"] },
  "abc-music": { file: "abc-music.md", sections: ["ABC Music"] },
  alert: { sections: ["Alert"] },
  archive: { sections: ["Archive"] },
  audio: { sections: ["Audio"] },
  bitflow: { file: "bitflow.md", sections: ["Bitflow"] },
  /** The official bitflow llms.txt, vendored: every task type in detail. */
  "bitflow-full": { file: "bitflow-llms.txt" },
  blockflow: { file: "blockflow.md", sections: ["Blockflow"] },
  bookmarks: { sections: ["Bookmarks"] },
  collapsible: { sections: ["Collapsible"] },
  download: { sections: ["Download"] },
  embed: { sections: ["Embed"] },
  excalidraw: { file: "excalidraw.md", sections: ["Excalidraw"] },
  geogebra: { sections: ["GeoGebra"] },
  h5p: { sections: ["H5P"] },
  jmp: { file: "jmp.md", sections: ["Java Memory Playground"] },
  /** The official JMP llms.txt, vendored. */
  "jmp-full": { file: "jmp-llms.txt" },
  jsxgraph: { file: "jsxgraph.md", sections: ["JSXGraph"] },
  kirimoto: { sections: ["Kiri:Moto"] },
  learningmap: { sections: ["Learningmap"] },
  mermaid: { file: "mermaid.md", sections: ["Mermaid"] },
  multievent: { file: "multievent.md", sections: ["Multievent"] },
  onlineide: { file: "onlineide.md", sections: ["Online IDE"] },
  openscad: { file: "openscad.md", sections: ["OpenSCAD"] },
  p5: { file: "p5.md", sections: ["P5"] },
  pagelist: { sections: ["Pagelist"] },
  passwordlist: { sections: ["Passwordlist"] },
  plantuml: { file: "plantuml.md", sections: ["PlantUML"] },
  protect: { sections: ["Protect", "Passwords"] },
  pyide: { file: "pyide.md", sections: ["Pyide"] },
  qr: { sections: ["QR Code"] },
  scratchblock: { sections: ["Scratchblock"] },
  slideshow: { sections: ["Slideshow"] },
  snippet: { sections: ["Snippets"] },
  sqlide: { file: "sqlide.md", sections: ["SQL IDE"] },
  struktolab: { file: "struktolab.md", sections: ["Struktolab"] },
  tabs: { sections: ["Tabs"] },
  textinput: { sections: ["Text Input"] },
  tiles: { sections: ["Tiles"] },
  typst: { file: "typst.md", sections: ["Typst"] },
  video: { sections: ["Video"] },
  webide: { file: "webide.md", sections: ["Web IDE"] },
  youtube: { sections: ["YouTube"] },
} as const satisfies Record<string, Topic>;

export type DocumentationKey = keyof typeof DOCUMENTATION;

/** The hyperbook.md section titles some topic uses. */
const WANTED = new Set<string>(
  Object.values(DOCUMENTATION).flatMap((topic: Topic) => topic.sections ?? []),
);

/**
 * Directive names (and likely guesses) that are documented under another
 * topic, so `read_docs` answers them instead of failing a call.
 */
const ALIASES: Record<string, DocumentationKey> = {
  tab: "tabs",
  tile: "tiles",
  term: "glossary",
  "blockflow-player": "blockflow",
  "blockflow-editor": "blockflow",
  "java-memory-playground": "jmp",
  snippets: "snippet",
  hyperbook: "markdown",
  "hyperbook.json": "book-config",
  "hyperlibrary.json": "library-config",
  frontmatter: "page-config",
  struktog: "struktolab",
};

/** The topic a name means, aliases included; null when there is none. */
export function documentationKey(name: string): DocumentationKey | null {
  const lower = name.trim().toLowerCase();
  if (Object.hasOwn(DOCUMENTATION, lower)) return lower as DocumentationKey;
  return ALIASES[lower] ?? null;
}

/** Largest documentation text handed to the model, in characters. */
const MAX_DOC_CHARS = 60_000;

const cache = new Map<DocumentationKey, string>();
let sections: Map<string, string> | null = null;

/** Test hook: empty the in-memory cache. */
export function clearDocumentationCache(): void {
  cache.clear();
  sections = null;
}

function localFile(file: string): string | null {
  const url = new URL(`./docs/${file}`, import.meta.url);
  return existsSync(url) ? readFileSync(fileURLToPath(url), "utf8") : null;
}

/**
 * hyperbook.md's sections by title. The llms.txt repeats each page's title
 * (`# Alert` twice); a section runs until the next such doubled heading, so
 * a page's own `# Heading` examples stay inside it.
 */
function hyperbookSections(): Map<string, string> {
  if (sections) return sections;
  sections = new Map();
  const text = localFile("hyperbook.md");
  if (!text) return sections;
  const lines = text.split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.startsWith("# ")) continue;
    let next = i + 1;
    while (next < lines.length && lines[next]!.trim() === "") next++;
    // Case-insensitively: the page "Pyide" is titled "PyIDE". A few pages
    // (PlantUML) are not doubled; a title a topic asks for counts anyway.
    const doubled = lines[next]?.toLowerCase() === lines[i]!.toLowerCase();
    if (doubled || WANTED.has(lines[i]!.slice(2).trim())) starts.push(i);
    // The doubled title is not a section of its own.
    if (doubled) i = next;
  }
  starts.forEach((start, index) => {
    const title = lines[start]!.slice(2).trim();
    let body = start + 1;
    while (lines[body]?.trim() === "") body++;
    // Skip the doubled title; the section is its body.
    if (lines[body]?.toLowerCase() === lines[start]!.toLowerCase()) body++;
    const end = starts[index + 1] ?? lines.length;
    const content = lines.slice(body, end).join("\n").trim();
    // A title used twice (Hosting) keeps its first, fuller section.
    if (!sections!.has(title)) sections!.set(title, `# ${title}\n\n${content}`);
  });
  return sections;
}

/**
 * One documentation topic as markdown (cached). Null when none of its
 * sources exists — the tool then tells the model so.
 */
export function readDocumentation(key: DocumentationKey): string | null {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const topic: Topic = DOCUMENTATION[key];
  const parts: string[] = [];
  if (topic.file) {
    const text = localFile(topic.file);
    if (text) parts.push(text.trim());
  }
  const official = (topic.sections ?? [])
    .map((title) => hyperbookSections().get(title))
    .filter((text): text is string => text !== undefined);
  if (official.length > 0) {
    if (parts.length > 0) parts.push("---\n\nOfficial reference:");
    parts.push(...official);
  }
  if (parts.length === 0) return null;
  let text = parts.join("\n\n");
  if (text.length > MAX_DOC_CHARS)
    text = `${text.slice(0, MAX_DOC_CHARS)}\n… (truncated)`;
  cache.set(key, text);
  return text;
}
