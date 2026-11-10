import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { Renderers, type RenderSpawner } from "../src/server/hosting/renders";
import { parseTypstDiagnostics } from "../src/shared/typst-diagnostics";
import { dataDirs, loggedIn, setup } from "./helpers";

const typst = (() => {
  if (process.env.TYPST_BINARY) return process.env.TYPST_BINARY;
  try {
    return execFileSync("which", ["typst"], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
})();

const text = (s: string) => new TextEncoder().encode(s);

/** An instance whose CLI lists Typst 0.15.1, compiling with the real typst. */
async function world() {
  const cliDir = mkdtempSync(path.join(os.tmpdir(), "cloud-typst-cli-"));
  dataDirs.push(cliDir);
  writeFileSync(
    path.join(cliDir, "typst-versions.json"),
    JSON.stringify({ format: 1, default: "0.15.1", versions: { "0.15.1": {} } }),
  );
  const instance = setup({ TYPST_BINARY: typst ?? "/nonexistent", HYPERBOOK_CLI: path.join(cliDir, "index.js") });
  const owner = await loggedIn(instance, { email: "o@example.org" });
  const book = (await owner.c.post("/api/books", { title: "Typst", slug: "typst" })).body;
  await owner.c.upload(
    `/api/books/${book.id}/source`,
    zipSync({
      "typst/hyperbook.json": text('{"name":"Typst","typst":{"version":"0.15.1"}}'),
      "typst/book/index.md": text('# Start\n\n::pdf[Blatt]{src="blatt.typ"}\n'),
      "typst/book/blatt.typ": text("= Blatt\n"),
      "typst/book/vorlage.typ": text("= Vorlage\n"),
    }),
  );
  return { instance, owner, book };
}

/** Stands in for `hyperbook render`: the start page shows blatt.typ and offers vorlage.typ. */
const typstRender: RenderSpawner = async () => ({
  async render(target) {
    if ("href" in target && target.href !== "/") return { ok: false, error: "There is no page here", log: "" };
    return {
      ok: true,
      href: "/",
      file: "book/index.md",
      out: "index.html",
      log: "",
      typstJobs: [{ src: "book/blatt.typ", out: "/blatt.pdf", inputs: {} }],
      typstDownloads: ["/vorlage.typ"],
    };
  },
  close() {},
});

describe.skipIf(!typst)("Typst in the preview", () => {
  it("compiles a document a rendered page shows, and keeps it until the checkout changes", async () => {
    const { instance, owner, book } = await world();
    const renders = new Renderers(instance.config, typstRender);
    try {
      // Not shown by any page yet.
      expect(await renders.typstDocument(book.id, "/blatt.pdf")).toBeNull();
      await renders.page(book.id, "/");
      const first = await renders.typstDocument(book.id, "/blatt.pdf");
      expect(first).toMatchObject({ ok: true });
      expect(await renders.typstDocument(book.id, "/blatt.pdf")).toEqual(first);

      // The editor's unsaved text of the document is what the preview shows.
      const preview = await renders.typstText(book.id, "book/blatt.typ", "= Blatt\n#nope()\n");
      expect(preview).toMatchObject({ ok: false, error: "Typst could not build book/blatt.typ" });
      const again = await renders.typstDocument(book.id, "/blatt.pdf");
      expect(again).toMatchObject({ ok: false });
      expect(!again!.ok && again!.diagnostics).toContain("unknown variable: nope");

      // A save moves the checkout on: the saved text compiles again.
      const listing = (await owner.c.get(`/api/books/${book.id}/files`)).body;
      const baseOid = listing.files.find((f: { path: string }) => f.path === "book/blatt.typ").oid;
      const saved = await owner.c.post(`/api/books/${book.id}/files/commit`, {
        changes: [{ op: "write", path: "book/blatt.typ", content: "= Blatt 2\n", baseOid }],
      });
      expect(saved.status).toBe(200);
      await renders.page(book.id, "/");
      expect(await renders.typstDocument(book.id, "/blatt.pdf")).toMatchObject({ ok: true });
    } finally {
      renders.close(book.id);
    }
  });

  it("serves a .typ source only when a page offers it", async () => {
    const { instance, book } = await world();
    const renders = new Renderers(instance.config, typstRender);
    try {
      expect(await renders.servesFile(book.id, "/vorlage.typ")).toBe(false);
      await renders.page(book.id, "/");
      expect(await renders.servesFile(book.id, "/vorlage.typ")).toBe(true);
      expect(await renders.servesFile(book.id, "/blatt.typ")).toBe(false);
      expect(await renders.servesFile(book.id, "/blatt.pdf")).toBe(true);
    } finally {
      renders.close(book.id);
    }
  });

  it("previews the editor's open .typ file: the PDF, or the diagnostics", async () => {
    const { owner, book } = await world();
    const ok = await owner.c.raw("POST", `/api/books/${book.id}/files/typst-preview`, {
      path: "book/blatt.typ",
      text: "= Neu\n",
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(String(ok.body).startsWith("%PDF-")).toBe(true);
    // It is the editor's text, not the saved one.
    expect(String(ok.body)).toContain("Title(Neu)");
    // The same text again: the same bytes, so the pane keeps its PDF.
    const again = await owner.c.raw("POST", `/api/books/${book.id}/files/typst-preview`, {
      path: "book/blatt.typ",
      text: "= Neu\n",
    });
    expect(again.body).toBe(ok.body);

    const broken = await owner.c.raw("POST", `/api/books/${book.id}/files/typst-preview`, {
      path: "book/blatt.typ",
      text: "= Neu\n\n#nope()\n",
    });
    expect(broken.status).toBe(422);
    expect(broken.body).toMatchObject({
      error: "Typst could not build book/blatt.typ",
      diagnostics: [{ file: "book/blatt.typ", line: 3, column: 1, severity: "error", message: "unknown variable: nope" }],
    });
  });

  it("previews only .typ files of the book", async () => {
    const { owner, book } = await world();
    const page = await owner.c.raw("POST", `/api/books/${book.id}/files/typst-preview`, { path: "book/index.md", text: "x" });
    expect(page.status).toBe(400);
    const outside = await owner.c.raw("POST", `/api/books/${book.id}/files/typst-preview`, { path: "../x.typ", text: "x" });
    expect(outside.status).toBe(400);
  });
});

describe("Typst diagnostics", () => {
  it("are read from Typst's short format, hints attached", () => {
    expect(
      parseTypstDiagnostics(
        "book/a.typ:3:1: error: unknown variable: nope\nhint: did you mean `none`?\n./b.typ:1:5: warning: unused\n",
      ),
    ).toEqual([
      { file: "book/a.typ", line: 3, column: 1, severity: "error", message: "unknown variable: nope\nhint: did you mean `none`?" },
      { file: "b.typ", line: 1, column: 5, severity: "warning", message: "unused" },
    ]);
  });
});
