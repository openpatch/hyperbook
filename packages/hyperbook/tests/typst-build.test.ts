import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { Hyperproject } from "@hyperbook/types";
import { runBuildProject } from "../build";

/** A real typst for these tests: HYPERBOOK_TYPST_BINARY, or one on PATH. */
const typst = (() => {
  if (process.env.HYPERBOOK_TYPST_BINARY) return process.env.HYPERBOOK_TYPST_BINARY;
  try {
    return execFileSync("which", ["typst"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

let root: string;
let cache: string;
let project: Hyperproject;
const saved = { ...process.env };

const write = async (file: string, text = "x") => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};
const out = (file: string) => path.join(root, ".hyperbook", "out", file);
const exists = (file: string) =>
  fs.stat(out(file)).then(() => true, () => false);
const build = () => runBuildProject(project, project);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-typst-build-"));
  cache = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-typst-cache-"));
  project = { name: "Typst", src: root, type: "book" };
  process.env.HYPERBOOK_ASSET_CACHE = cache;
  process.env.SOURCE_DATE_EPOCH = "1700000000";
  if (typst) process.env.HYPERBOOK_TYPST_BINARY = typst;
  await write(
    "hyperbook.json",
    JSON.stringify({ name: "Typst", typst: { version: "0.15.1", packagePath: "pakete" } }),
  );
  await write("templates/kopf.typ", '#let kopf(t) = heading(t)\n');
  await write("pakete/local/aufgaben/1.0.0/typst.toml", '[package]\nname = "aufgaben"\nversion = "1.0.0"\nentrypoint = "lib.typ"\n');
  await write("pakete/local/aufgaben/1.0.0/lib.typ", "#let aufgabe(t) = [Aufgabe: #t]\n");
  await write("book/bild.svg", "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>");
  await write(
    "book/blatt.typ",
    [
      '#import "/templates/kopf.typ": kopf',
      '#import "@local/aufgaben:1.0.0": aufgabe',
      "#kopf[Blatt]",
      "#aufgabe[Rechne]",
      '#image("bild.svg")',
      '#if sys.inputs.at("loesung", default: "false") == "true" [Lösung: 42]',
    ].join("\n"),
  );
  await write("book/intern.typ", "= Intern");
  await write("book/vorlage.typ", "= Vorlage");
  await write(
    "book/index.md",
    [
      "# Start",
      '::pdf[Blatt]{src="blatt.typ"}',
      '::pdf[Lösung]{src="blatt.typ" inputs="loesung=true"}',
      ':download[Vorlage]{src="vorlage.typ"}',
    ].join("\n\n"),
  );
});

afterEach(async () => {
  process.env = { ...saved };
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(cache, { recursive: true, force: true });
});

describe.skipIf(!typst)("Typst documents in a build", () => {
  it("builds every referenced document and publishes no source but the downloaded one", async () => {
    await build();
    expect(await exists("blatt.pdf")).toBe(true);
    const html = await fs.readFile(out("index.html"), "utf8");
    const variant = /\/blatt\.([0-9a-f]{8})\.pdf/.exec(html)?.[0];
    expect(variant).toBeDefined();
    expect(await exists(variant!.slice(1))).toBe(true);
    expect((await fs.readFile(out("blatt.pdf"))).subarray(0, 5).toString()).toBe("%PDF-");
    // The variant with inputs differs from the plain one.
    expect(Buffer.compare(await fs.readFile(out("blatt.pdf")), await fs.readFile(out(variant!.slice(1))))).not.toBe(0);
    // No source unless a download names it, and no PDF of an unreferenced one.
    expect(await exists("blatt.typ")).toBe(false);
    expect(await exists("intern.typ")).toBe(false);
    expect(await exists("intern.pdf")).toBe(false);
    expect(await exists("vorlage.typ")).toBe(true);
    expect(await exists("vorlage.pdf")).toBe(false);
  });

  it("gives the same bytes for the same commit, and skips unchanged documents", async () => {
    await build();
    const first = await fs.readFile(out("blatt.pdf"));
    const entries = await fs.readdir(path.join(root, ".hyperbook", "typst-cache"));
    expect(entries.filter((e) => e.endsWith(".json"))).toHaveLength(2);
    const stamp = (await fs.stat(path.join(root, ".hyperbook", "typst-cache", entries.find((e) => e.endsWith(".pdf"))!))).mtimeMs;

    // Without a change nothing is compiled: the cache entries stay as they were.
    await build();
    expect(Buffer.compare(first, await fs.readFile(out("blatt.pdf")))).toBe(0);
    const again = (await fs.stat(path.join(root, ".hyperbook", "typst-cache", entries.find((e) => e.endsWith(".pdf"))!))).mtimeMs;
    expect(again).toBe(stamp);
  });

  it("compiles again when an imported file changes", async () => {
    await build();
    const first = await fs.readFile(out("blatt.pdf"));
    await write("templates/kopf.typ", "#let kopf(t) = heading(level: 2, t)\n");
    await build();
    expect(Buffer.compare(first, await fs.readFile(out("blatt.pdf")))).not.toBe(0);
  });

  it("fails the build with Typst's diagnostics", async () => {
    await write("book/blatt.typ", "= Blatt\n#nope()\n");
    await expect(build()).rejects.toThrow(/book\/blatt\.typ:2:\d+: error: unknown variable: nope/);
  });

  it("fails when a PDF of the same name is in the book", async () => {
    await write("book/blatt.pdf", "%PDF-1.4");
    await expect(build()).rejects.toThrow(/book\/blatt\.typ would be built to \/blatt\.pdf, but book\/blatt\.pdf/);
  });

  it("does not read outside the book", async () => {
    await write("book/blatt.typ", '#read("/../../etc/hostname")\n');
    await expect(build()).rejects.toThrow(/escape the project root/);
  });

  it("uses shared packages, the book's copy winning", async () => {
    const shared = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-typst-shared-"));
    try {
      const pkg = (ns: string, name: string, body: string) =>
        Promise.all([
          fs.mkdir(path.join(shared, ns, name, "1.0.0"), { recursive: true }).then(() =>
            Promise.all([
              fs.writeFile(path.join(shared, ns, name, "1.0.0", "typst.toml"), `[package]\nname = "${name}"\nversion = "1.0.0"\nentrypoint = "lib.typ"\n`),
              fs.writeFile(path.join(shared, ns, name, "1.0.0", "lib.typ"), body),
            ]),
          ),
        ]);
      await pkg("local", "assessio", '#import "@openpatch/mathora:1.0.0": m\n#let task = [assessio #m]\n');
      await pkg("openpatch", "mathora", "#let m = [mathora]\n");
      // Also in the book: the book's copy is used.
      await pkg("local", "aufgaben", "#let aufgabe(t) = [SHARED #t]\n");
      process.env.HYPERBOOK_TYPST_PACKAGE_PATH = shared;
      await write("book/blatt.typ", '#import "@local/assessio:1.0.0": task\n#import "@local/aufgaben:1.0.0": aufgabe\n#task #aufgabe[x]\n');
      await build();
      expect(await exists("blatt.pdf")).toBe(true);
      const pdf = (await fs.readFile(out("blatt.pdf"))).toString("latin1");
      expect(pdf).toContain("%PDF-");
      // The book's own package won.
      const links = await fs.readlink(path.join(root, ".hyperbook", "typst-packages", "local", "aufgaben", "1.0.0"));
      expect(links).toBe(path.join(root, "pakete", "local", "aufgaben", "1.0.0"));
    } finally {
      await fs.rm(shared, { recursive: true, force: true });
    }
  });
});

describe("Typst documents in manifest mode", () => {
  it("writes the jobs for the host and starts no compiler", async () => {
    process.env.HYPERBOOK_TYPST = "manifest";
    process.env.HYPERBOOK_TYPST_BINARY = "/nonexistent/typst";
    await build();
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, ".hyperbook", "typst-jobs.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      format: 1,
      version: "0.15.1",
      packagePath: "pakete",
      fontPath: null,
      outDir: ".hyperbook/out",
    });
    expect(manifest.jobs).toEqual([
      { src: "book/blatt.typ", out: "/blatt.pdf", inputs: {} },
      { src: "book/blatt.typ", out: expect.stringMatching(/^\/blatt\.[0-9a-f]{8}\.pdf$/), inputs: { loesung: "true" } },
    ]);
    expect(await exists("blatt.pdf")).toBe(false);
  });

  it("refuses a Typst version this Hyperbook does not support", async () => {
    process.env.HYPERBOOK_TYPST = "manifest";
    await write("hyperbook.json", JSON.stringify({ name: "Typst", typst: { version: "0.14.2" } }));
    await expect(build()).rejects.toThrow(/Typst 0\.14\.2 is not supported/);
  });

  it("refuses a package folder outside the book", async () => {
    process.env.HYPERBOOK_TYPST = "manifest";
    await write("hyperbook.json", JSON.stringify({ name: "Typst", typst: { version: "0.15.1", packagePath: "../x" } }));
    await expect(build()).rejects.toThrow(/inside the book/);
  });
});

describe.skipIf(!typst)("Typst documents in the dev server", () => {
  it("builds a document when it is asked for and keeps sources private", async () => {
    const { BookBackend } = await import("../dev-book");
    const { AssetManager } = await import("../helpers/assets");
    const backend = new BookBackend(root, project, new AssetManager());
    await backend.start();
    try {
      const page = await backend.serve("");
      expect(page?.status).toBe(200);
      const pdf = await backend.serve("blatt.pdf");
      expect(pdf?.status).toBe(200);
      expect(pdf?.type).toBe("application/pdf");
      expect(pdf && "file" in pdf ? pdf.file : null).toBe(out("blatt.pdf"));
      // Offered for download: served. Not offered: not there.
      expect((await backend.serve("vorlage.typ"))?.status).toBe(200);
      expect(await backend.serve("blatt.typ")).toBeNull();
      expect(await backend.serve("intern.typ")).toBeNull();

      // A broken document answers with Typst's diagnostics.
      await write("book/blatt.typ", "#nope()\n");
      const broken = await backend.serve("blatt.pdf");
      expect(broken?.status).toBe(500);
      expect(String(broken && "body" in broken ? broken.body : "")).toContain("unknown variable: nope");
    } finally {
      // Stops the background indexer, if it runs as a process.
      (backend as any).indexer?.close?.();
    }
  });
});

describe("Typst packages of :::typst blocks", () => {
  const block = (imports: string) =>
    ["# Start", ":::typst", '```typ file="main.typ"', imports, "= Blatt", "```", ":::", ""].join("\n");

  it("packs the packages a block imports into the site, also the ones they import", async () => {
    const shared = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-typst-shared-"));
    try {
      await fs.mkdir(path.join(shared, "local", "assessio", "0.1.0"), { recursive: true });
      await fs.writeFile(path.join(shared, "local", "assessio", "0.1.0", "typst.toml"), '[package]\nname = "assessio"\nversion = "0.1.0"\n');
      await fs.writeFile(path.join(shared, "local", "assessio", "0.1.0", "lib.typ"), "#let x = 1\n");
      await write("pakete/local/aufgaben/1.0.0/lib.typ", '#import "@local/assessio:0.1.0": x\n#let aufgabe(t) = t\n');
      process.env.HYPERBOOK_TYPST_PACKAGE_PATH = shared;
      process.env.HYPERBOOK_TYPST = "manifest";
      await write("book/index.md", block('#import "@local/aufgaben:1.0.0": aufgabe'));
      await build();
      expect(await exists("__hyperbook_typst/local/aufgaben-1.0.0.tar.gz")).toBe(true);
      expect(await exists("__hyperbook_typst/local/assessio-0.1.0.tar.gz")).toBe(true);
      const { list } = await import("tar");
      const entries: string[] = [];
      await list({ file: out("__hyperbook_typst/local/aufgaben-1.0.0.tar.gz"), onReadEntry: (e) => entries.push(e.path) });
      expect(entries.sort()).toEqual(["lib.typ", "typst.toml"]);
      const html = await fs.readFile(out("index.html"), "utf8");
      expect(html).toContain("data-packages=");
      expect(html).toContain("/__hyperbook_typst/local/assessio-0.1.0.tar.gz");
    } finally {
      await fs.rm(shared, { recursive: true, force: true });
    }
  });

  it("refuses to publish a package the book excludes", async () => {
    process.env.HYPERBOOK_TYPST = "manifest";
    await write(
      "hyperbook.json",
      JSON.stringify({ name: "Typst", typst: { version: "0.15.1", packagePath: "pakete" }, exclude: ["pakete/local/aufgaben/**"] }),
    );
    await write("book/index.md", block('#import "@local/aufgaben:1.0.0": aufgabe'));
    await expect(build()).rejects.toThrow(/@local\/aufgaben:1\.0\.0 .* excluded/);
  });
});
