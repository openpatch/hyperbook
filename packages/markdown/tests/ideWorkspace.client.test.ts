import { describe, expect, it } from "vitest";
import {
  checkNewPath,
  decodeWorkspace,
  mayChange,
  mergeWorkspace,
  parseFileActions,
  savableFiles,
  // @ts-expect-error The browser bundle is JavaScript.
} from "../ide-bundle/workspace.js";

const page = {
  main: "main.py",
  files: [
    { path: "main.py", content: "print('page')" },
    { path: "helpers.py", content: "def greet(): pass" },
    { path: "data.txt", content: "a,b", readonly: true },
    {
      path: "test_1.py",
      content: "#SCRIPT#\nassert True",
      role: "test",
      hidden: true,
    },
  ],
};

describe("decodeWorkspace", () => {
  it("reads the UTF-8 the server encoded", () => {
    const json = JSON.stringify({
      main: "main.py",
      files: [{ path: "main.py", content: "prüfe()" }],
    });
    const attribute = Buffer.from(json).toString("base64");
    expect(decodeWorkspace(attribute).files[0].content).toBe("prüfe()");
  });

  it("gives an empty workspace for a missing attribute", () => {
    expect(decodeWorkspace(null)).toEqual({ main: "", files: [] });
  });
});

describe("mergeWorkspace", () => {
  it("uses the page when nothing is saved", () => {
    const merged = mergeWorkspace(page, undefined);
    expect(merged.files).toEqual(page.files);
    expect(merged.active).toBe("main.py");
    expect(merged.removed).toEqual([]);
  });

  it("keeps the reader's version of the files they may edit", () => {
    const merged = mergeWorkspace(page, {
      id: "x",
      runtime: "pyide",
      files: [
        { path: "main.py", content: "print('mine')" },
        { path: "helpers.py", content: "def greet(): print('hi')" },
      ],
    });
    expect(merged.files.map((f: any) => f.content)).toEqual([
      "print('mine')",
      "def greet(): print('hi')",
      "a,b",
      "#SCRIPT#\nassert True",
    ]);
  });

  it("always takes readonly, hidden and test files from the page", () => {
    const merged = mergeWorkspace(page, {
      id: "x",
      runtime: "pyide",
      files: [
        { path: "data.txt", content: "tampered" },
        { path: "test_1.py", content: "assert False" },
      ],
    });
    expect(merged.files[2].content).toBe("a,b");
    expect(merged.files[3].content).toBe("#SCRIPT#\nassert True");
  });

  it("adds a file the author added after the reader started", () => {
    const merged = mergeWorkspace(page, {
      id: "x",
      runtime: "pyide",
      files: [{ path: "main.py", content: "mine" }],
    });
    expect(merged.files.map((f: any) => f.path)).toContain("helpers.py");
  });

  it("keeps the reader's own files only where they may add files", () => {
    const saved = {
      id: "x",
      runtime: "pyide",
      files: [{ path: "extra.py", content: "x = 1", created: true }],
    };
    expect(
      mergeWorkspace(page, saved).files.some((f: any) => f.path === "extra.py"),
    ).toBe(false);
    expect(
      mergeWorkspace(page, saved, { allowCreate: true }).files.at(-1),
    ).toEqual({ path: "extra.py", content: "x = 1", created: true });
  });

  it("reopens the last tab, falling back to main", () => {
    const saved = (active: string) => ({
      id: "x",
      runtime: "pyide",
      files: [],
      active,
    });
    expect(mergeWorkspace(page, saved("helpers.py")).active).toBe(
      "helpers.py",
    );
    expect(mergeWorkspace(page, saved("gone.py")).active).toBe("main.py");
    expect(mergeWorkspace(page, saved("test_1.py")).active).toBe("main.py");
  });

  it("restores a row converted from the old pyide table", () => {
    const single = {
      main: "main.py",
      files: [{ path: "main.py", content: "print('page')" }],
    };
    const converted = {
      id: "x",
      runtime: "pyide",
      migratedFrom: "pyide",
      files: [{ path: "main.py", content: "print('from 2025')" }],
      active: "main.py",
      ui: {},
    };
    expect(mergeWorkspace(single, converted).files).toEqual([
      { path: "main.py", content: "print('from 2025')" },
    ]);
  });
});

describe("removed page files", () => {
  const saved = (removed: string[], files: any[] = []) => ({
    id: "x",
    runtime: "pyide",
    files,
    removed,
  });

  it("leaves out page files the reader deleted", () => {
    const merged = mergeWorkspace(page, saved(["helpers.py"]));
    expect(merged.files.map((f: any) => f.path)).not.toContain("helpers.py");
    expect(merged.removed).toEqual(["helpers.py"]);
  });

  it("never removes the main file, readonly, hidden or test files", () => {
    const merged = mergeWorkspace(
      page,
      saved(["main.py", "data.txt", "test_1.py", "gone.py"]),
    );
    expect(merged.files.map((f: any) => f.path)).toEqual([
      "main.py",
      "helpers.py",
      "data.txt",
      "test_1.py",
    ]);
    expect(merged.removed).toEqual([]);
  });

  it("shows a renamed page file under its new name", () => {
    const merged = mergeWorkspace(
      page,
      saved(["helpers.py"], [
        { path: "util.py", content: "def greet(): pass", created: true },
      ]),
      { allowCreate: true },
    );
    expect(merged.files.map((f: any) => f.path)).toEqual([
      "main.py",
      "data.txt",
      "test_1.py",
      "util.py",
    ]);
  });

  it("brings a page file back that was renamed back to its name", () => {
    const merged = mergeWorkspace(
      page,
      saved(["helpers.py"], [{ path: "helpers.py", content: "mine" }]),
    );
    expect(merged.files[1]).toEqual({ path: "helpers.py", content: "mine" });
  });
});

describe("file actions", () => {
  it("reads the data-files attribute", () => {
    expect(parseFileActions("create, upload")).toEqual({
      create: true,
      upload: true,
      rename: false,
      delete: false,
    });
    expect(parseFileActions(null)).toEqual({
      create: false,
      upload: false,
      rename: false,
      delete: false,
    });
  });

  it("lets readers change their own files, and the page's only when allowed", () => {
    const own = { path: "mine.py", content: "", created: true };
    const pages = { path: "helpers.py", content: "" };
    const locked = { path: "data.txt", content: "", readonly: true };
    expect(mayChange(own, "main.py", false)).toBe(true);
    expect(mayChange(pages, "main.py", false)).toBe(false);
    expect(mayChange(pages, "main.py", true)).toBe(true);
    expect(mayChange(locked, "main.py", true)).toBe(false);
    expect(mayChange({ path: "main.py", content: "" }, "main.py", true)).toBe(
      false,
    );
  });

  it("lets a renamed file keep its name", () => {
    expect(checkNewPath("helpers.py", page.files, [".py"], "helpers.py")).toBe(
      null,
    );
    expect(checkNewPath("main.py", page.files, [".py"], "helpers.py")).toBe(
      "exists",
    );
  });
});

describe("savableFiles", () => {
  it("saves only what the reader can change", () => {
    expect(
      savableFiles([
        ...page.files,
        { path: "extra.py", content: "x", created: true },
      ]),
    ).toEqual([
      { path: "main.py", content: "print('page')" },
      { path: "helpers.py", content: "def greet(): pass" },
      { path: "extra.py", content: "x", created: true },
    ]);
  });
});

describe("checkNewPath", () => {
  it.each<[string, string | null]>([
    ["", "empty"],
    ["   ", "empty"],
    ["/abs.py", "invalid"],
    ["../up.py", "invalid"],
    ["dir/", "invalid"],
    ["a//b.py", "invalid"],
    ["notes.txt", "extension"],
    ["helpers.py", "exists"],
    ["lib/util.py", null],
    ["new.py", null],
  ])("%j → %s", (path: string, problem: string | null) => {
    expect(checkNewPath(path, page.files, [".py"])).toBe(problem);
  });

  it("allows any extension when none is required", () => {
    expect(checkNewPath("notes.txt", page.files, [])).toBeNull();
  });
});
