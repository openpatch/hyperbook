import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extension, visualKind, visualProblem } from "../src/web/pages/editor/visual-kinds";
import { starter, starterEncoding, toBase64 } from "../src/web/pages/editor/files";

describe("visual file kinds", () => {
  it("maps extensions to their element's editor", () => {
    expect(visualKind("public/game.sb3")).toBe("blockflow");
    expect(visualKind("book/tutorial.blockflow")).toBe("blockflow-project");
    expect(visualKind("book/quiz.bitflow")).toBe("bitflow");
    expect(visualKind("book/map.learningmap")).toBe("learningmap");
    expect(visualKind("book/drawing.excalidraw")).toBe("excalidraw");
    expect(visualKind("book/memory.jmp")).toBe("jmp");
    expect(visualKind("book/s.struktolab")).toBe("struktolab");
    expect(visualKind("book/page.md")).toBeNull();
    expect(visualKind("book/demo.h5p")).toBeNull();
    expect(extension("book/A.SB3")).toBe("sb3");
  });

  it("accepts base64 of a zip as a blockflow document, nothing else", () => {
    const sb3 = toBase64(zipSync({ "project.json": new TextEncoder().encode("{}") }));
    expect(visualProblem("blockflow", sb3)).toBeNull();
    expect(visualProblem("blockflow", "")).toBeNull();
    expect(visualProblem("blockflow", toBase64(new TextEncoder().encode("not a zip")))).toMatch(/not a .sb3/);
    expect(visualProblem("blockflow", "!!!not base64!!!")).toMatch(/base64/);
  });

  it("still checks the JSON editors", () => {
    expect(visualProblem("bitflow", "{")).toMatch(/JSON/);
    expect(visualProblem("bitflow", "{}")).toBeNull();
    expect(visualProblem("blockflow-project", "{")).toMatch(/JSON/);
    expect(visualProblem("blockflow-project", '{"title":"T"}')).toBeNull();
    expect(visualProblem("struktolab-pseudocode", "not json")).toBeNull();
  });

  it("starts a new .sb3 as an empty project, base64-encoded", () => {
    const content = starter("public/game.sb3");
    expect(starterEncoding("public/game.sb3")).toBe("base64");
    expect(starterEncoding("book/page.md")).toBe("utf8");
    const bytes = Uint8Array.from(atob(content), (ch) => ch.charCodeAt(0));
    // A zip, with project.json in it.
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    expect(visualProblem("blockflow", content)).toBeNull();
  });

  it("starts a new .blockflow as a project file, plain JSON", () => {
    const content = starter("book/tutorial.blockflow");
    expect(starterEncoding("book/tutorial.blockflow")).toBe("utf8");
    expect(JSON.parse(content)).toEqual({ title: "New tutorial" });
    expect(visualProblem("blockflow-project", content)).toBeNull();
  });
});
