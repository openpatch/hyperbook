import { describe, expect, it } from "vitest";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { IncrementalBuilder } from "../incremental";

const root = path.join(path.sep, "tmp", "book");
const project: Hyperproject = { name: "Test", src: root, type: "book" };

const makeBuilder = () => new IncrementalBuilder(root, project);

/** Seeds the reverse dependency index without running a build. */
const record = (builder: IncrementalBuilder, href: string, deps: string[]) =>
  (builder as any).recordPageResult(href, {
    dependencies: deps,
    searchDocuments: [],
  });

const dependentsOf = (builder: IncrementalBuilder, file: string): string[] => [
  ...((builder as any).dependents.get(file) ?? []),
];

describe("IncrementalBuilder.classifyChange", () => {
  it("treats config as a full rebuild", () => {
    const builder = makeBuilder();
    expect(builder.classifyChange("hyperbook.json", "change")).toBe("config");
    expect(builder.classifyChange("hyperlibrary.json", "change")).toBe(
      "config",
    );
  });

  it("treats a markdown page as a content change", () => {
    const builder = makeBuilder();
    expect(builder.classifyChange(path.join("book", "a.md"), "change")).toBe(
      "content-book",
    );
    expect(
      builder.classifyChange(path.join("glossary", "term.md"), "change"),
    ).toBe("content-glossary");
  });

  it("treats adding or removing a file as structural", () => {
    const builder = makeBuilder();
    expect(builder.classifyChange(path.join("book", "a.md"), "add")).toBe(
      "structural",
    );
    expect(builder.classifyChange(path.join("book", "a.md"), "unlink")).toBe(
      "structural",
    );
  });

  it("treats an unreferenced asset as a plain public file", () => {
    const builder = makeBuilder();
    expect(
      builder.classifyChange(path.join("public", "logo.png"), "change"),
    ).toBe("public");
    // A script under book/ that no page inlines is just an asset too.
    expect(builder.classifyChange(path.join("book", "loose.py"), "change")).toBe(
      "public",
    );
  });

  it("treats a file inlined by a page as a dependency, not an asset", () => {
    const builder = makeBuilder();
    const script = path.join(root, "public", "script.py");
    record(builder, "/lesson", [script]);

    // Without the graph this would be classified "public" and the page that
    // embeds the script would keep serving stale content.
    expect(
      builder.classifyChange(path.join("public", "script.py"), "change"),
    ).toBe("dependency");
    expect(dependentsOf(builder, script)).toEqual(["/lesson"]);
  });

  it("maps a snippet to only the pages that use it", () => {
    const builder = makeBuilder();
    const snippet = path.join(root, "snippets", "note.md.hbs");
    record(builder, "/uses-it", [snippet]);
    record(builder, "/does-not", []);

    expect(
      builder.classifyChange(path.join("snippets", "note.md.hbs"), "change"),
    ).toBe("dependency");
    expect(dependentsOf(builder, snippet)).toEqual(["/uses-it"]);
  });

  it("falls back to a full rebuild for an unused snippet", () => {
    const builder = makeBuilder();
    expect(
      builder.classifyChange(path.join("snippets", "orphan.md.hbs"), "change"),
    ).toBe("structural");
  });

  it("collects every page that shares a dependency", () => {
    const builder = makeBuilder();
    const shared = path.join(root, "snippets", "shared.md.hbs");
    record(builder, "/one", [shared]);
    record(builder, "/two", [shared]);
    expect(dependentsOf(builder, shared).sort()).toEqual(["/one", "/two"]);
  });
});

describe("IncrementalBuilder dependency index", () => {
  it("drops the edge when a page stops using a file", () => {
    const builder = makeBuilder();
    const script = path.join(root, "book", "local.py");

    record(builder, "/lesson", [script]);
    expect(builder.classifyChange(path.join("book", "local.py"), "change")).toBe(
      "dependency",
    );

    // The page is edited and no longer embeds the script.
    record(builder, "/lesson", []);
    expect(dependentsOf(builder, script)).toEqual([]);
    expect(builder.classifyChange(path.join("book", "local.py"), "change")).toBe(
      "public",
    );
  });

  it("keeps other pages' edges when one page is reindexed", () => {
    const builder = makeBuilder();
    const shared = path.join(root, "snippets", "shared.md.hbs");
    record(builder, "/one", [shared]);
    record(builder, "/two", [shared]);

    record(builder, "/one", []);

    expect(dependentsOf(builder, shared)).toEqual(["/two"]);
  });
});
