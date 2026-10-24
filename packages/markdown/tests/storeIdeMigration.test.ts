import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * The pyide saved one script per directive. Since v11 every IDE keeps a
 * workspace of files in the `ide` table; the upgrade, and an import of an old
 * export, convert the rows. A wrong conversion here silently loses a
 * learner's code, so the shape is pinned down exactly.
 */

/** Runs the browser script and returns what it put on `hyperbook`. */
const loadMigration = () => {
  const source = readFileSync(
    path.join(__dirname, "../assets/store-ide-migration.js"),
    "utf8",
  );
  const window: { hyperbook?: any } = {};
  new Function("window", source)(window);
  return window.hyperbook.storeIdeMigration;
};

const { convertLegacyIdeRow, moveLegacyIdeRows } = loadMigration();

/** A stand-in for the few Dexie table methods the migration calls. */
class FakeTable {
  readonly rows = new Map<string, any>();
  constructor(rows: any[] = []) {
    for (const row of rows) this.rows.set(row.id, row);
  }
  async toArray() {
    return [...this.rows.values()];
  }
  async get(key: string) {
    return this.rows.get(key);
  }
  async put(row: any) {
    this.rows.set(row.id, row);
  }
  async clear() {
    this.rows.clear();
  }
}

describe("convertLegacyIdeRow", () => {
  it("turns a pyide script into the workspace's main.py", () => {
    expect(
      convertLegacyIdeRow("pyide", { id: "abc", script: "print(1)" }),
    ).toEqual({
      id: "abc",
      runtime: "pyide",
      migratedFrom: "pyide",
      files: [{ path: "main.py", content: "print(1)" }],
      active: "main.py",
      ui: {},
    });
  });

  it("keeps the remembered split sizes", () => {
    const row = convertLegacyIdeRow("pyide", {
      id: "abc",
      script: "",
      splitHorizontal: 412.4,
      splitVertical: 300,
      splitCanvasOutput: 180,
    });
    expect(row.ui).toEqual({
      splitHorizontal: 412,
      splitVertical: 300,
      splitCanvasOutput: 180,
    });
  });

  it("drops split sizes that cannot be applied", () => {
    const row = convertLegacyIdeRow("pyide", {
      id: "abc",
      script: "x = 1",
      splitHorizontal: 0,
      splitVertical: Number.NaN,
      splitCanvasOutput: "200",
    });
    expect(row.ui).toEqual({});
  });

  it("keeps an empty script, which the learner may have cleared on purpose", () => {
    expect(
      convertLegacyIdeRow("pyide", { id: "abc", script: "" }).files,
    ).toEqual([{ path: "main.py", content: "" }]);
  });

  it("ignores rows without a script or an id", () => {
    expect(convertLegacyIdeRow("pyide", { id: "abc" })).toBeNull();
    expect(convertLegacyIdeRow("pyide", { script: "x" })).toBeNull();
    expect(convertLegacyIdeRow("pyide", null)).toBeNull();
  });

  it("turns a p5 sketch into sketch.js", () => {
    expect(
      convertLegacyIdeRow("p5", { id: "s", sketch: "circle(1,1,1)" }).files,
    ).toEqual([{ path: "sketch.js", content: "circle(1,1,1)" }]);
  });

  it("keeps an OpenSCAD model's uploads and parameters", () => {
    const row = convertLegacyIdeRow("openscad", {
      id: "m",
      code: "cube(1);",
      params: '{"size":2}',
      binaryFiles: [
        { dest: "/part.stl", url: "data:model/stl;base64,AAA=" },
        { dest: "", url: "data:," },
        { dest: "/no-url.stl" },
      ],
      splitCanvasParams: 120,
    });
    expect(row.files).toEqual([
      { path: "main.scad", content: "cube(1);" },
      { path: "part.stl", url: "data:model/stl;base64,AAA=", created: true },
    ]);
    expect(row.extra).toEqual({ params: '{"size":2}' });
    expect(row.ui).toEqual({ splitCanvasParams: 120 });
  });

  it("keeps all of a Typst document's sources and the open one", () => {
    const row = convertLegacyIdeRow("typst", {
      id: "t",
      code: "= ignored, the sources win",
      sourceFiles: [
        { filename: "main.typ", content: "#include \"other.typ\"" },
        { filename: "/other.typ", content: "Other" },
      ],
      binaryFiles: [{ dest: "/logo.png", url: "data:image/png;base64,AA==" }],
      currentFile: "other.typ",
    });
    expect(row.files).toEqual([
      { path: "main.typ", content: '#include "other.typ"' },
      { path: "other.typ", content: "Other" },
      { path: "logo.png", url: "data:image/png;base64,AA==", created: true },
    ]);
    expect(row.active).toBe("other.typ");
  });

  it("falls back to a Typst row's code when it has no sources", () => {
    expect(
      convertLegacyIdeRow("typst", { id: "t", code: "Hi" }).files,
    ).toEqual([{ path: "main.typ", content: "Hi" }]);
    expect(convertLegacyIdeRow("typst", { id: "t" })).toBeNull();
  });

  it("leaves tables it does not know alone", () => {
    expect(
      convertLegacyIdeRow("textinput", { id: "abc", text: "x" }),
    ).toBeNull();
  });
});

describe("moveLegacyIdeRows", () => {
  const setup = (pyide: any[], ide: any[] = []) => {
    const tables: Record<string, FakeTable> = {
      pyide: new FakeTable(pyide),
      p5: new FakeTable(),
      openscad: new FakeTable(),
      typst: new FakeTable(),
      ide: new FakeTable(ide),
    };
    return { tables, table: (name: string) => tables[name] };
  };

  it("moves every pyide row into ide and empties the pyide table", async () => {
    const { tables, table } = setup([
      { id: "a", script: "print('a')" },
      { id: "b", script: "print('b')" },
    ]);
    await moveLegacyIdeRows(table);
    expect(tables.pyide.rows.size).toBe(0);
    expect(tables.ide.rows.get("a").files).toEqual([
      { path: "main.py", content: "print('a')" },
    ]);
    expect(tables.ide.rows.get("b").files).toEqual([
      { path: "main.py", content: "print('b')" },
    ]);
  });

  it("does not overwrite work saved in the new IDE since", async () => {
    const newer = {
      id: "a",
      runtime: "pyide",
      files: [{ path: "main.py", content: "newer" }],
    };
    const { tables, table } = setup([{ id: "a", script: "older" }], [newer]);
    await moveLegacyIdeRows(table);
    expect(tables.ide.rows.get("a")).toBe(newer);
    expect(tables.pyide.rows.size).toBe(0);
  });

  it("is a no-op the second time", async () => {
    const { tables, table } = setup([{ id: "a", script: "x" }]);
    await moveLegacyIdeRows(table);
    const first = tables.ide.rows.get("a");
    await moveLegacyIdeRows(table);
    expect(tables.ide.rows.get("a")).toBe(first);
  });
});
