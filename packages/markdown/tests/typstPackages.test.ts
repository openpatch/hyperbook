import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findTypstImports, resolveTypstPackages, typstPackageHref } from "../src/typstPackages";

let root: string;
let shared: string;
const saved = process.env.HYPERBOOK_TYPST_PACKAGE_PATH;

const pkg = (base: string, ns: string, name: string, version: string, lib: string) => {
  const dir = path.join(base, ns, name, version);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "typst.toml"), `[package]\nname = "${name}"\nversion = "${version}"\nentrypoint = "lib.typ"\n`);
  fs.writeFileSync(path.join(dir, "lib.typ"), lib);
  return dir;
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-typst-packages-"));
  shared = fs.mkdtempSync(path.join(os.tmpdir(), "hyperbook-typst-shared-"));
  process.env.HYPERBOOK_TYPST_PACKAGE_PATH = shared;
});

afterEach(() => {
  if (saved === undefined) delete process.env.HYPERBOOK_TYPST_PACKAGE_PATH;
  else process.env.HYPERBOOK_TYPST_PACKAGE_PATH = saved;
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(shared, { recursive: true, force: true });
});

const ctx = (packagePath?: string) => ({ root, config: { name: "B", typst: packagePath ? { packagePath } : undefined } });

describe("typst packages", () => {
  it("finds every import, once", () => {
    expect(
      findTypstImports('#import "@local/a:1.0.0": *\n#import "@preview/cetz:0.3.4"\n#import "@local/a:1.0.0": x\n#import "/rel.typ"'),
    ).toEqual([
      { namespace: "local", name: "a", version: "1.0.0" },
      { namespace: "preview", name: "cetz", version: "0.3.4" },
    ]);
  });

  it("finds the book's and the shared packages and follows their imports; the book's copy wins", () => {
    const own = pkg(path.join(root, "pakete"), "local", "aufgaben", "1.0.0", '#import "@local/assessio:0.1.0": x\n');
    const assessio = pkg(shared, "local", "assessio", "0.1.0", '#import "@openpatch/mathora:1.0.0": m\n');
    const mathora = pkg(shared, "openpatch", "mathora", "1.0.0", "#let m = 1\n");
    pkg(shared, "local", "aufgaben", "1.0.0", "shared copy\n");
    const found = resolveTypstPackages(ctx("pakete"), findTypstImports('#import "@local/aufgaben:1.0.0": *\n#import "@preview/cetz:0.3.4"'));
    expect(found.map((p) => [`@${p.namespace}/${p.name}:${p.version}`, p.dir])).toEqual([
      ["@local/aufgaben:1.0.0", own],
      ["@local/assessio:0.1.0", assessio],
      ["@openpatch/mathora:1.0.0", mathora],
    ]);
    expect(found[0]!.href).toBe("/__hyperbook_typst/local/aufgaben-1.0.0.tar.gz");
  });

  it("serves a Universe package the book carries, and leaves the others to Universe", () => {
    pkg(path.join(root, "pakete"), "preview", "cetz", "0.3.4", "");
    const found = resolveTypstPackages(ctx("pakete"), findTypstImports('#import "@preview/cetz:0.3.4"\n#import "@preview/other:1.0.0"'));
    expect(found.map((p) => p.href)).toEqual([typstPackageHref({ namespace: "preview", name: "cetz", version: "0.3.4" })]);
  });

  it("ignores a package folder outside the book", () => {
    // root/book is the book; root/outside is not part of it.
    const book = path.join(root, "book");
    fs.mkdirSync(book);
    pkg(path.join(root, "outside"), "local", "nope", "1.0.0", "");
    const found = resolveTypstPackages(
      { root: book, config: { name: "B", typst: { packagePath: "../outside" } } },
      findTypstImports('#import "@local/nope:1.0.0"'),
    );
    expect(found).toEqual([]);
  });
});
