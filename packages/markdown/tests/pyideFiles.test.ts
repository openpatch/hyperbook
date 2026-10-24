import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCodeMeta } from "../src/ideWorkspace";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("parseCodeMeta", () => {
  it("reads quoted, unquoted and bare attributes", () => {
    expect(
      parseCodeMeta(`file="my file.py" role=test hidden title='x y'`),
    ).toEqual({ file: "my file.py", role: "test", hidden: true, title: "x y" });
  });

  it("gives nothing for an empty meta", () => {
    expect(parseCodeMeta(null)).toEqual({});
    expect(parseCodeMeta("")).toEqual({});
  });
});

/** Enough of Emscripten's FS for syncWorkspaceFiles. */
const fakePyodide = () => {
  const files = new Map<string, string | Uint8Array>();
  const dirs = new Set<string>();
  const python: string[] = [];
  return {
    files,
    dirs,
    python,
    FS: {
      mkdirTree: (dir: string) => dirs.add(dir),
      writeFile: (p: string, data: string | Uint8Array) => files.set(p, data),
      unlink: (p: string) => {
        if (!files.delete(p)) throw new Error("ENOENT");
      },
    },
    runPython: (code: string) => python.push(code),
  };
};

const load = async () =>
  // @ts-expect-error The browser client is JavaScript.
  await import("../assets/directive-pyide/src/files.js");

describe("syncWorkspaceFiles", () => {
  it("writes the workspace below /home/pyodide, tests excepted", async () => {
    const { syncWorkspaceFiles } = await load();
    const pyodide = fakePyodide();
    await syncWorkspaceFiles("ide", pyodide, [
      { path: "main.py", content: "import lib.util" },
      { path: "lib/util.py", content: "X = 1" },
      { path: "test_1.py", content: "#SCRIPT#", role: "test" },
    ]);
    expect([...pyodide.files.keys()]).toEqual([
      "/home/pyodide/main.py",
      "/home/pyodide/lib/util.py",
    ]);
    expect(pyodide.dirs).toContain("/home/pyodide/lib");
    // The reader's modules are forgotten, so an edit is imported anew.
    expect(pyodide.python[0]).toContain("del sys.modules[name]");
  });

  it("removes files that left the workspace since the last run", async () => {
    const { syncWorkspaceFiles } = await load();
    const pyodide = fakePyodide();
    await syncWorkspaceFiles("ide", pyodide, [
      { path: "main.py", content: "" },
      { path: "old.py", content: "" },
    ]);
    await syncWorkspaceFiles("ide", pyodide, [{ path: "main.py", content: "" }]);
    expect([...pyodide.files.keys()]).toEqual(["/home/pyodide/main.py"]);
  });

  it("fetches binary files and reports the ones that fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/ok.png"
          ? { ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer }
          : { ok: false, status: 404 },
      ),
    );
    const { syncWorkspaceFiles } = await load();
    const pyodide = fakePyodide();
    const warnings = await syncWorkspaceFiles("ide", pyodide, [
      { path: "ok.png", url: "/ok.png" },
      { path: "missing.png", url: "/missing.png" },
    ]);
    expect(pyodide.files.get("/home/pyodide/ok.png")).toEqual(
      new Uint8Array([1, 2]),
    );
    expect(warnings).toEqual(["Could not load missing.png: 404 /missing.png"]);
  });
});
