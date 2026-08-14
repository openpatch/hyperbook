import { describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";

/**
 * The syntactic form(s) each directive accepts.
 *
 * Derived from what each one actually renders, not from convention:
 *
 * - `text` (`:name`) is for directives producing an inline element. Only
 *   archive, download and term do — they render an `<a>`.
 * - `container` (`:::name`) is for directives that consume a body, whether by
 *   letting children through (alert, collapsible) or by reading them as source
 *   (pyide, jsxgraph, mermaid).
 * - `leaf` (`::name`) is for directives configured entirely by attributes. A
 *   body written on one of these is silently discarded.
 *
 * Several accept two forms because their content is optional: geogebra takes a
 * material id or a body; struktolab a `src` or inline source; the code editors
 * (pyide, webide, typst, openscad) render a usable empty editor as a leaf,
 * which is how a blank exercise is written; and archive/download work inline
 * within a sentence as well as standalone.
 */
const EXPECTED: Record<string, ("text" | "leaf" | "container")[]> = {
  alert: ["container"],
  archive: ["text", "leaf"],
  audio: ["leaf"],
  bookmarks: ["leaf"],
  collapsible: ["container"],
  download: ["text", "leaf"],
  embed: ["leaf"],
  excalidraw: ["leaf"],
  geogebra: ["leaf", "container"],
  h5p: ["leaf"],
  jmp: ["leaf"],
  jsxgraph: ["container"],
  kirimoto: ["leaf"],
  learningmap: ["leaf"],
  mermaid: ["container"],
  multievent: ["container"],
  onlineide: ["container"],
  openscad: ["leaf", "container"],
  pagelist: ["leaf"],
  plantuml: ["container"],
  protect: ["container"],
  pyide: ["leaf", "container"],
  qr: ["leaf"],
  scratchblock: ["container"],
  slideshow: ["container"],
  sqlide: ["container"],
  struktog: ["leaf"],
  struktolab: ["leaf", "container"],
  tabs: ["container"],
  textinput: ["leaf"],
  tiles: ["container"],
  typst: ["leaf", "container"],
  video: ["leaf"],
  webide: ["leaf", "container"],
  youtube: ["leaf"],
};

/** Minimal attributes so each directive renders at all. */
const ATTRS: Record<string, string> = {
  alert: "{info}",
  archive: '{name="demo"}',
  audio: '{src="/a.mp3"}',
  collapsible: '{title="T"}',
  download: '{src="/f.zip"}',
  embed: '{src="https://example.com"}',
  excalidraw: "{#e}",
  geogebra: '{src="https://www.geogebra.org/m/abc"}',
  h5p: '{src="/h5p/demo"}',
  jmp: '{src="memory.jmp"}',
  learningmap: '{src="/map.json"}',
  multievent: "{#m}",
  protect: '{password="x"}',
  qr: '{value="https://example.com"}',
  struktog: "{#s}",
  struktolab: "{#sl}",
  video: '{src="/v.mp4"}',
  youtube: "{#abc123}",
};

const write = (form: string, name: string, attrs: string) => {
  if (form === "text") return `Prefix :${name}[label]${attrs} suffix\n`;
  if (form === "leaf") return `::${name}${attrs}\n`;
  return `:::${name}${attrs}\nbody\n:::\n`;
};

/** Diagnostics emitted about this directive's form. */
const formInfosFor = async (name: string, form: string) => {
  const file = await process(write(form, name, ATTRS[name] ?? ""), ctx);
  return file.messages
    .map((m) => String(m.reason))
    .filter((r) => r.includes(`${name}"`) && r.startsWith("Unexpected"));
};

describe("directive form expectations", () => {
  for (const [name, allowed] of Object.entries(EXPECTED)) {
    describe(name, () => {
      for (const form of allowed) {
        it(`accepts the ${form} form`, async () => {
          expect(await formInfosFor(name, form)).toEqual([]);
        });
      }

      const rejected = (["text", "leaf", "container"] as const).filter(
        (f) => !allowed.includes(f),
      );
      for (const form of rejected) {
        it(`reports the ${form} form`, async () => {
          const infos = await formInfosFor(name, form);
          expect(infos).toHaveLength(1);
          // The message has to say what to write instead.
          expect(infos[0]).toMatch(/use (one|two|three) colons?/);
        });
      }
    });
  }
});
