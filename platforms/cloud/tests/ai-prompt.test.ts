import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "../src/server/ai/prompt";
import { DIRECTIVES } from "../src/web/pages/editor/directives";

/*
 * The system prompt's directive vocabulary is the editor's: the assistant
 * must neither invent elements nor miss any (platforms/cloud/docs/cloud-ai-assistant.md).
 */

function promptDirectives(): Set<string> {
  // Only the vocabulary block counts — the rest of the prompt backticks other
  // things too (`src`, `db`, folder names, …).
  const block = SYSTEM_PROMPT.split("Available:\n\n")[1]!.split("\n\n")[0]!;
  const found = new Set<string>();
  for (const match of block.matchAll(/`([a-z0-9-]+)`/g)) {
    found.add(match[1]!);
  }
  return found;
}

describe("AI system prompt", () => {
  it("lists every directive the editor knows, and nothing else", () => {
    const known = new Set(DIRECTIVES.map((directive) => directive.name));
    const listed = promptDirectives();
    expect([...listed].filter((name) => !known.has(name))).toEqual([]);
    expect([...known].filter((name) => !listed.has(name))).toEqual([]);
  });

  it("shows how the file-based and IDE elements take their files", () => {
    // The elements a teacher asks for by name must have their file conventions
    // in the prompt (write the file with write_file, reference it with src).
    for (const name of [
      "bitflow",
      "blockflow-player",
      "struktolab",
      "jmp",
      "excalidraw",
      "pyide",
      "webide",
      "onlineide",
      "sqlide",
      "p5",
      "typst",
    ]) {
      expect(SYSTEM_PROMPT).toContain(`\`${name}\``);
    }
    for (const ext of [".bitflow", ".struktolab", ".jmp", ".excalidraw", ".sb3"]) {
      expect(SYSTEM_PROMPT).toContain(ext);
    }
    expect(SYSTEM_PROMPT).toContain("write_file");
  });

  it("is checked in by the same file the server ships", () => {
    // The prompt is a constant the bundler ships; if this ever changes to a
    // file, this test reminds whoever moves it to keep it shipped.
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/server/ai/prompt.ts",
      ),
      "utf8",
    );
    expect(source).toContain("SYSTEM_PROMPT");
  });
});
