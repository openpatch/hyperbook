import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, readdir, readlink, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Config } from "../src/server/config";
import { BuildLog, cliPermissions } from "../src/server/hosting/runner";
import {
  TypstService,
  checkTree,
  parseTypstManifest,
  typstCacheDir,
  typstDir,
  typstLibrary,
} from "../src/server/hosting/typst";
import { dataDirs, setup } from "./helpers";

/** A real typst for the compile tests: TYPST_BINARY, or one on PATH. */
const typst = (() => {
  if (process.env.TYPST_BINARY) return process.env.TYPST_BINARY;
  try {
    return execFileSync("which", ["typst"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

const tmp = (prefix: string) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  dataDirs.push(dir);
  return dir;
};

const write = async (file: string, text: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
};

const manifest = (jobs: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 1, version: "0.15.1", packagePath: null, fontPath: null, outDir: ".hyperbook/out", jobs, ...extra });

const job = { src: "book/blatt.typ", out: "/blatt.pdf", inputs: {} };
/** Seconds of work Typst cannot memoize away. */
const SLOW = "#let x = 0\n#for i in range(0, 200000000) { x += 1 }\n#x\n";
const options = { versions: ["0.15.0", "0.15.1"], maxJobs: 3 };

describe("the list of Typst documents", () => {
  it("is accepted as the CLI writes it", () => {
    const parsed = parseTypstManifest(manifest([job, { ...job, out: "/blatt.1a2b3c4d.pdf", inputs: { loesung: "true" } }]), options);
    expect(parsed).toMatchObject({ ok: true, manifest: { version: "0.15.1", jobs: [job, expect.anything()] } });
  });

  it.each([
    ["an unsupported version", manifest([job], { version: "0.14.2" }), /not supported/],
    ["another output", manifest([job], { outDir: "../x" }), /build's output/],
    ["a package folder outside the book", manifest([job], { packagePath: "../lib" }), /inside the book/],
    ["a source outside the book", manifest([{ ...job, src: "../etc/passwd.typ" }]), /invalid source/],
    ["an absolute source", manifest([{ ...job, src: "/etc/x.typ" }]), /invalid source/],
    ["a source that is no .typ", manifest([{ ...job, src: "book/a.pdf" }]), /invalid source/],
    ["an address that leaves the output", manifest([{ ...job, out: "/../x.pdf" }]), /invalid address/],
    ["an address that is no PDF", manifest([{ ...job, out: "/index.html" }]), /invalid address/],
    ["two jobs for one address", manifest([job, job]), /Two Typst documents/],
    ["a bad input name", manifest([{ ...job, inputs: { "a b": "1" } }]), /invalid input/],
    ["too many jobs", manifest([1, 2, 3, 4].map((n) => ({ ...job, out: `/b${n}.pdf` }))), /at most 3/],
    ["no JSON", "{", /not valid JSON/],
  ])("refuses %s", (_, text, error) => {
    const parsed = parseTypstManifest(text, options);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(error);
  });

  it("refuses a checkout with a link in it", async () => {
    const dir = tmp("cloud-typst-tree-");
    await write(path.join(dir, "book", "a.typ"), "= A");
    expect(await checkTree(dir)).toBeNull();
    await symlink("/etc/hostname", path.join(dir, "book", "host.typ"));
    expect(await checkTree(dir)).toMatch(/link \(host\.typ\)/);
  });

  it("is kept where the sandboxed CLI can neither read nor write; only the shared packages are readable", () => {
    const { config } = setup();
    const flags = cliPermissions(config, path.join(config.dataDir, "tmp", "job"));
    expect(flags.filter((flag) => flag.includes(typstDir(config)))).toEqual([`--allow-fs-read=${typstLibrary(config)}`]);
  });
});

/** A config whose CLI lists Typst 0.15.1, using the real typst. */
function typstConfig(overrides: Partial<Config["typst"]> = {}): Config {
  const { config } = setup();
  const cliDir = tmp("cloud-typst-cli-");
  const versions = { format: 1, default: "0.15.1", versions: { "0.15.1": {} } };
  execFileSync("sh", ["-c", `printf '%s' '${JSON.stringify(versions)}' > "$1"`, "sh", path.join(cliDir, "typst-versions.json")]);
  return {
    ...config,
    build: { ...config.build, cli: path.join(cliDir, "index.js") },
    typst: { ...config.typst, binary: typst, ...overrides },
  };
}

/** A checkout as the sandboxed CLI leaves it: sources, output, the list. */
async function checkout(jobs: unknown[], files: Record<string, string>, extra: Record<string, unknown> = {}) {
  const jobDir = tmp("cloud-typst-job-");
  const srcDir = path.join(jobDir, "src");
  const outDir = path.join(srcDir, ".hyperbook", "out");
  await mkdir(outDir, { recursive: true });
  for (const [file, text] of Object.entries(files)) await write(path.join(srcDir, file), text);
  await write(path.join(srcDir, ".hyperbook", "typst-jobs.json"), manifest(jobs, extra));
  return { jobDir, srcDir, outDir };
}

const BLATT = {
  "templates/kopf.typ": "#let kopf(t) = heading(t)\n",
  "book/blatt.typ": '#import "/templates/kopf.typ": kopf\n#kopf[Blatt]\n#sys.inputs.at("loesung", default: "")\n',
};

async function build(config: Config, place: Awaited<ReturnType<typeof checkout>>, more: Partial<Parameters<TypstService["build"]>[0]> = {}) {
  const log = new BuildLog();
  const outcome = await new TypstService(config).build({
    bookId: 7,
    ...place,
    log,
    signal: new AbortController().signal,
    deadline: Date.now() + 60_000,
    budgetBytes: 50 * 1024 * 1024,
    creationTimestamp: 1_700_000_000,
    ...more,
  });
  return { outcome, log: log.toString() };
}

describe.skipIf(!typst)("building Typst documents", () => {
  it("builds the listed documents into the output, the same bytes each time", async () => {
    const config = typstConfig();
    const first = await checkout([job, { ...job, out: "/blatt.v.pdf", inputs: { loesung: "ja" } }], BLATT);
    const { outcome, log } = await build(config, first);
    expect(outcome).toMatchObject({ ok: true, built: 2, cached: 0 });
    expect((await readFile(path.join(first.outDir, "blatt.pdf"))).subarray(0, 5).toString()).toBe("%PDF-");
    expect(log).toContain("Typst: 2 document(s) built, 0 unchanged");

    // The next build of the same commit takes both from the cache.
    const second = await checkout([job, { ...job, out: "/blatt.v.pdf", inputs: { loesung: "ja" } }], BLATT);
    expect((await build(config, second)).outcome).toMatchObject({ ok: true, built: 0, cached: 2 });
    expect(await readFile(path.join(second.outDir, "blatt.pdf"))).toEqual(await readFile(path.join(first.outDir, "blatt.pdf")));
  });

  it("compiles again when an imported file changed, and keeps only what the build used", async () => {
    const config = typstConfig();
    await build(config, await checkout([job, { ...job, out: "/b.pdf", src: "book/b.typ" }], { ...BLATT, "book/b.typ": "= B" }));
    const changed = await checkout([job], { ...BLATT, "templates/kopf.typ": "#let kopf(t) = heading(level: 2, t)\n" });
    expect((await build(config, changed)).outcome).toMatchObject({ ok: true, built: 1, cached: 0 });
    // b.typ is not used anymore: its entry is gone.
    expect((await readdir(typstCacheDir(config, 7))).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });

  it("drops a cache entry whose PDF was changed", async () => {
    const config = typstConfig();
    await build(config, await checkout([job], BLATT));
    const dir = typstCacheDir(config, 7);
    const pdf = (await readdir(dir)).find((f) => f.endsWith(".pdf"))!;
    await writeFile(path.join(dir, pdf), "%PDF-tampered");
    const again = await checkout([job], BLATT);
    expect((await build(config, again)).outcome).toMatchObject({ ok: true, built: 1, cached: 0 });
    expect((await readFile(path.join(again.outDir, "blatt.pdf"))).toString()).not.toContain("tampered");
  });

  it("fails with Typst's diagnostics and leaves no PDF behind", async () => {
    const config = typstConfig();
    const place = await checkout([job], { "book/blatt.typ": "= Blatt\n#nope()\n" });
    const { outcome, log } = await build(config, place);
    expect(outcome).toEqual({ ok: false, error: "Typst could not build book/blatt.typ" });
    expect(log).toMatch(/book\/blatt\.typ:2:\d+: error: unknown variable: nope/);
    expect(await readdir(place.outDir)).toEqual([]);
  });

  it("stops a document that takes too long", async () => {
    const config = typstConfig({ timeoutMs: 500 });
    const slow = SLOW;
    const { outcome } = await build(config, await checkout([job], { "book/blatt.typ": slow }));
    expect(outcome).toEqual({ ok: false, error: expect.stringContaining("took longer than") });
  });

  it("stops a document when the build's deadline comes first", async () => {
    const config = typstConfig();
    const slow = SLOW;
    const started = Date.now();
    const { outcome } = await build(config, await checkout([job], { "book/blatt.typ": slow }), { deadline: Date.now() + 700 });
    expect(outcome.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("stops when the build is canceled", async () => {
    const config = typstConfig();
    const abort = new AbortController();
    const slow = SLOW;
    setTimeout(() => abort.abort(), 300);
    const { outcome } = await build(config, await checkout([job], { "book/blatt.typ": slow }), { signal: abort.signal });
    expect(outcome).toEqual({ ok: false, error: "The build was canceled" });
  });

  it.skipIf(process.platform !== "linux")("stops a document that needs too much memory", async () => {
    const config = typstConfig({ memoryMb: 512 });
    const hungry = "#let a = range(0, 30000000).map(i => str(i) * 20)\n#a.len()\n";
    const { outcome } = await build(config, await checkout([job], { "book/blatt.typ": hungry }));
    expect(outcome).toEqual({ ok: false, error: expect.stringContaining("needs more memory than allowed") });
  });

  it.skipIf(process.platform !== "linux")("stops a PDF that outgrows what the book may hold", async () => {
    const config = typstConfig();
    const big = "#for i in range(0, 400) [#lorem(400) #pagebreak()]\n";
    const place = await checkout([job], { "book/blatt.typ": big });
    const { outcome } = await build(config, place, { budgetBytes: 20 * 1024 });
    expect(outcome).toEqual({ ok: false, error: expect.stringContaining("larger than this book may hold") });
    expect(await readdir(place.outDir)).toEqual([]);
  });

  it("refuses a checkout the build put a link into", async () => {
    const config = typstConfig();
    const place = await checkout([job], BLATT);
    await symlink("/etc/hostname", path.join(place.srcDir, "book", "host"));
    expect((await build(config, place)).outcome).toEqual({ ok: false, error: expect.stringContaining("link (host)") });
  });

  it("refuses an output folder the build made a link", async () => {
    const config = typstConfig();
    const outside = tmp("cloud-typst-outside-");
    const place = await checkout([{ ...job, out: "/sub/blatt.pdf" }], BLATT);
    await symlink(outside, path.join(place.outDir, "sub"));
    // The link is in the output, not the sources: only the output check sees it.
    const { outcome } = await build(config, place);
    expect(outcome.ok).toBe(false);
    expect(await readdir(outside)).toEqual([]);
  });

  it("uses the instance's shared packages, the book's own copy winning", async () => {
    const config = typstConfig();
    const pkg = (root: string, ns: string, name: string, body: string) =>
      Promise.all([
        write(path.join(root, ns, name, "1.0.0", "typst.toml"), `[package]\nname = "${name}"\nversion = "1.0.0"\nentrypoint = "lib.typ"\n`),
        write(path.join(root, ns, name, "1.0.0", "lib.typ"), body),
      ]);
    await pkg(typstLibrary(config), "local", "assessio", '#import "@local/mathora:1.0.0": m\n#let task = [assessio #m]\n');
    await pkg(typstLibrary(config), "local", "mathora", "#let m = [shared mathora]\n");
    const place = await checkout(
      [job],
      { "book/blatt.typ": '#import "@local/assessio:1.0.0": task\n#task\n' },
      { packagePath: "pakete" },
    );
    await pkg(path.join(place.srcDir, "pakete"), "local", "mathora", "#let m = [book mathora]\n");
    expect((await build(config, place)).outcome).toMatchObject({ ok: true, built: 1 });
    expect(await readlink(path.join(place.jobDir, "typst-packages", "local", "mathora", "1.0.0"))).toBe(
      path.join(place.srcDir, "pakete", "local", "mathora", "1.0.0"),
    );
    // A change to a shared package compiles the document again.
    await pkg(typstLibrary(config), "local", "assessio", '#import "@local/mathora:1.0.0": m\n#let task = [assessio 2 #m]\n');
    const again = await checkout([job], { "book/blatt.typ": '#import "@local/assessio:1.0.0": task\n#task\n' }, { packagePath: "pakete" });
    await pkg(path.join(again.srcDir, "pakete"), "local", "mathora", "#let m = [book mathora]\n");
    expect((await build(config, again)).outcome).toMatchObject({ ok: true, built: 1, cached: 0 });
  });

  it("does nothing without a list", async () => {
    const config = typstConfig();
    const jobDir = tmp("cloud-typst-none-");
    const srcDir = path.join(jobDir, "src");
    await mkdir(path.join(srcDir, ".hyperbook", "out"), { recursive: true });
    const { outcome } = await build(config, { jobDir, srcDir, outDir: path.join(srcDir, ".hyperbook", "out") });
    expect(outcome).toEqual({ ok: true, bytes: 0, built: 0, cached: 0 });
  });
});

describe("the Typst binary", () => {
  const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

  async function release(content: string) {
    const dir = tmp("cloud-typst-release-");
    const target = process.arch === "arm64" ? "aarch64-unknown-linux-musl" : "x86_64-unknown-linux-musl";
    const inner = `typst-${target}/typst`;
    await write(path.join(dir, "src", inner), content);
    execFileSync("tar", ["-cJf", path.join(dir, "r.tar.xz"), "-C", path.join(dir, "src"), inner]);
    const archive = await readFile(path.join(dir, "r.tar.xz"));
    const cliDir = tmp("cloud-typst-cli-");
    const versions = {
      format: 1,
      default: "9.9.9",
      versions: {
        "9.9.9": {
          [target]: { url: "https://example.com/typst.tar.xz", sha256: sha(archive), format: "tar.xz", binary: inner, binarySha256: sha(content) },
        },
      },
    };
    await write(path.join(cliDir, "typst-versions.json"), JSON.stringify(versions));
    const { config } = setup();
    return { archive, config: { ...config, build: { ...config.build, cli: path.join(cliDir, "index.js") } } };
  }

  it.skipIf(process.platform !== "linux")("is downloaded once by the server, checked, and kept outside the sandbox", async () => {
    const { archive, config } = await release("#!/bin/sh\necho typst\n");
    let downloads = 0;
    const service = new TypstService(config, async () => {
      downloads++;
      return new Response(new Uint8Array(archive));
    });
    const binary = await service.binary("9.9.9");
    expect(binary).toBe(path.join(typstDir(config), "bin", "9.9.9", "typst"));
    expect((await stat(binary)).mode & 0o111).not.toBe(0);
    await service.binary("9.9.9");
    expect(downloads).toBe(1);
  });

  it.skipIf(process.platform !== "linux")("is refused when it does not match its checksum", async () => {
    const { config } = await release("#!/bin/sh\necho typst\n");
    const service = new TypstService(config, async () => new Response("not the archive"));
    await expect(service.binary("9.9.9")).rejects.toThrow(/checksum/);
  });

  it("says what to do when it cannot be downloaded", async () => {
    const { config } = await release("x");
    const service = new TypstService(config, async () => {
      throw new Error("no network");
    });
    await expect(service.binary("9.9.9")).rejects.toThrow(process.platform === "linux" ? /TYPST_BINARY/ : /not available/);
  });
});
