import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BuildLog, sandboxedRunner } from "../src/server/hosting/runner";
import { Renderers } from "../src/server/hosting/renders";
import { zipSync } from "fflate";
import { dataDirs, loggedIn, setup } from "./helpers";

/*
 * The real path: the built Hyperbook CLI in Node's permission sandbox lists
 * the Typst documents (it may not start a process), and the server compiles
 * them. Needs the built CLI and a typst binary; skipped without them.
 */

const typst = (() => {
  if (process.env.TYPST_BINARY) return process.env.TYPST_BINARY;
  try {
    return execFileSync("which", ["typst"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

const { config: base } = setup();
const cliBuilt = existsSync(base.build.cli) && existsSync(path.join(path.dirname(base.build.cli), "typst-versions.json"));

describe.skipIf(!typst || !cliBuilt)("Typst in a sandboxed build", () => {
  it("lists the documents in the sandbox and builds them on the server", async () => {
    const { config } = setup({ TYPST_BINARY: typst! });
    const jobDir = mkdtempSync(path.join(os.tmpdir(), "cloud-typst-sandbox-"));
    dataDirs.push(jobDir);
    const srcDir = path.join(jobDir, "src");
    const write = async (file: string, text: string) => {
      await mkdir(path.dirname(path.join(srcDir, file)), { recursive: true });
      await writeFile(path.join(srcDir, file), text);
    };
    await write("hyperbook.json", JSON.stringify({ name: "Typst", typst: { version: "0.15.1" } }));
    await write("book/index.md", '# Start\n\n::pdf[Blatt]{src="blatt.typ"}\n\n:download[Vorlage]{src="vorlage.typ"}\n');
    await write("book/blatt.typ", '#import "/templates/kopf.typ": kopf\n#kopf[Blatt]\n');
    await write("templates/kopf.typ", "#let kopf(t) = heading(t)\n");
    await write("book/vorlage.typ", "= Vorlage\n");
    await write("book/intern.typ", "= Intern\n");

    const log = new BuildLog();
    const outcome = await sandboxedRunner({
      config,
      jobDir,
      srcDir,
      log,
      signal: new AbortController().signal,
      cdnElements: [],
      bookId: 1,
      creationTimestamp: 1_700_000_000,
    });
    expect(outcome, log.toString()).toMatchObject({ ok: true });
    const out = path.join(srcDir, ".hyperbook", "out");
    expect((await readFile(path.join(out, "blatt.pdf"))).subarray(0, 5).toString()).toBe("%PDF-");
    expect(existsSync(path.join(out, "vorlage.typ"))).toBe(true);
    expect(existsSync(path.join(out, "intern.typ"))).toBe(false);
    expect(existsSync(path.join(out, "blatt.typ"))).toBe(false);
    expect(log.toString()).toContain("left to the host to build");
    expect(log.toString()).toContain("Typst: 1 document(s) built");
  }, 120_000);

  it("shows a page's documents in the preview, rendered by the sandboxed CLI", async () => {
    const instance = setup({ TYPST_BINARY: typst! });
    const owner = await loggedIn(instance, { email: "o@example.org" });
    const book = (await owner.c.post("/api/books", { title: "Typst", slug: "typst" })).body;
    const text = (t: string) => new TextEncoder().encode(t);
    await owner.c.upload(
      `/api/books/${book.id}/source`,
      zipSync({
        "typst/hyperbook.json": text(JSON.stringify({ name: "Typst", typst: { version: "0.15.1" } })),
        "typst/book/index.md": text('# Start\n\n::pdf[Blatt]{src="blatt.typ" inputs="loesung=true"}\n'),
        "typst/book/blatt.typ": text('= Blatt\n#sys.inputs.at("loesung", default: "nein")\n'),
      }),
    );
    const renders = new Renderers(instance.config);
    try {
      const page = await renders.page(book.id, "/");
      expect(page?.render).toMatchObject({ ok: true });
      const html = await readFile(path.join(page!.outDir, (page!.render as { out: string }).out), "utf8");
      const address = /data-src="(\/blatt\.[0-9a-f]{8}\.pdf)"/.exec(html)?.[1];
      expect(address).toBeDefined();
      const document = await renders.typstDocument(book.id, address!);
      expect(document).toMatchObject({ ok: true });
      expect((await readFile((document as { file: string }).file)).subarray(0, 5).toString()).toBe("%PDF-");
      expect(await renders.servesFile(book.id, "/blatt.typ")).toBe(false);
    } finally {
      renders.close(book.id);
    }
  }, 120_000);

  it("packs the shared packages a :::typst block imports, read by the sandboxed CLI", async () => {
    const { config } = setup({ TYPST_BINARY: typst! });
    const library = path.join(config.dataDir, "typst", "library", "local", "assessio", "0.1.0");
    await mkdir(library, { recursive: true });
    await writeFile(path.join(library, "typst.toml"), '[package]\nname = "assessio"\nversion = "0.1.0"\nentrypoint = "lib.typ"\n');
    await writeFile(path.join(library, "lib.typ"), "#let punkte(n) = [#n Punkte]\n");
    const jobDir = mkdtempSync(path.join(os.tmpdir(), "cloud-typst-sandbox-"));
    dataDirs.push(jobDir);
    const srcDir = path.join(jobDir, "src");
    await mkdir(path.join(srcDir, "book"), { recursive: true });
    await writeFile(path.join(srcDir, "hyperbook.json"), JSON.stringify({ name: "Typst" }));
    await writeFile(
      path.join(srcDir, "book", "index.md"),
      '# Start\n\n:::typst\n\n```typ file="main.typ"\n#import "@local/assessio:0.1.0": punkte\n#punkte(3)\n```\n\n:::\n',
    );
    const log = new BuildLog();
    const outcome = await sandboxedRunner({ config, jobDir, srcDir, log, signal: new AbortController().signal, cdnElements: [], bookId: 2 });
    expect(outcome, log.toString()).toMatchObject({ ok: true });
    expect(existsSync(path.join(srcDir, ".hyperbook", "out", "__hyperbook_typst", "local", "assessio-0.1.0.tar.gz"))).toBe(true);
  }, 120_000);
});
