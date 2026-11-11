import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { auditLog } from "../src/server/db/schema";
import { packageManifest } from "../src/server/hosting/typst-library";
import { typstFonts, typstLibrary } from "../src/server/hosting/typst";
import { fontNames } from "../src/server/hosting/typst-fonts";
import { ADMIN_HOST, ADMIN_ORIGIN, loggedIn, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);
const toml = (name: string, version: string) =>
  text(`[package]\nname = "${name}"\nversion = "${version}"\nentrypoint = "lib.typ"\n`);

async function world() {
  const instance = setup();
  const admin = await loggedIn(instance, { email: "a@example.org", role: "admin" });
  const teacher = await loggedIn(instance, { email: "t@example.org" });
  /** Uploads `zip` with a namespace, like the settings page. */
  const add = async (zip: Uint8Array, namespace = "local", as = admin) => {
    const form = new FormData();
    form.append("file", new File([zip as BlobPart], "package.zip", { type: "application/zip" }));
    form.append("namespace", namespace);
    const res = await instance.app.request("/api/instance/typst-packages", {
      method: "POST",
      headers: { host: ADMIN_HOST, origin: ADMIN_ORIGIN, cookie: as.c.cookie },
      body: form,
    });
    return { status: res.status, body: await res.json() };
  };
  return { instance, admin, teacher, add };
}

describe("typst.toml", () => {
  it("names the package and its version", () => {
    expect(packageManifest('[package]\nname = "assessio" # tasks\nversion = "0.1.0"\n[tool.x]\nname = "other"\n')).toEqual({
      name: "assessio",
      version: "0.1.0",
    });
    expect(packageManifest('name = "x"\nversion = "1.0.0"\n')).toBeNull();
  });
});

describe("the instance's Typst packages", () => {
  it("are added by admins, at the place typst.toml names, inside one folder or not", async () => {
    const { instance, admin, add } = await world();
    const added = await add(zipSync({ "assessio/typst.toml": toml("assessio", "0.1.0"), "assessio/lib.typ": text("#let x = 1") }));
    expect(added).toMatchObject({ status: 200, body: { namespace: "local", name: "assessio", version: "0.1.0" } });
    expect(existsSync(path.join(typstLibrary(instance.config), "local", "assessio", "0.1.0", "lib.typ"))).toBe(true);
    await add(zipSync({ "typst.toml": toml("mathora", "1.2.3"), "lib.typ": text("") }), "openpatch");

    const listed = (await admin.c.get("/api/instance/typst-packages")).body.packages;
    expect(listed.map((p: { namespace: string; name: string; version: string }) => `@${p.namespace}/${p.name}:${p.version}`)).toEqual([
      "@local/assessio:0.1.0",
      "@openpatch/mathora:1.2.3",
    ]);
    const actions = instance.db.select().from(auditLog).all().map((e) => e.action);
    expect(actions.filter((a) => a === "instance.typstPackageAdd")).toHaveLength(2);
  });

  it("never replaces a version", async () => {
    const { add } = await world();
    const zip = zipSync({ "typst.toml": toml("assessio", "0.1.0"), "lib.typ": text("") });
    await add(zip);
    expect(await add(zip)).toMatchObject({ status: 409, body: { error: "typstLibrary.exists" } });
  });

  it.each([
    ["no typst.toml", zipSync({ "lib.typ": text("") }), "typstLibrary.noManifest"],
    ["two typst.toml", zipSync({ "a/typst.toml": toml("a", "1.0.0"), "b/typst.toml": toml("b", "1.0.0") }), "typstLibrary.noManifest"],
    ["a bad name", zipSync({ "typst.toml": toml("Bad Name", "1.0.0") }), "typstLibrary.badManifest"],
    ["a bad version", zipSync({ "typst.toml": toml("ok", "latest") }), "typstLibrary.badManifest"],
    ["a path out of the zip", zipSync({ "typst.toml": toml("ok", "1.0.0"), "../evil.typ": text("") }), "typstLibrary.invalidPath"],
    [
      "a link",
      zipSync({ "typst.toml": toml("ok", "1.0.0"), link: [text("/etc/passwd"), { os: 3, attrs: (0o120777 << 16) >>> 0 }] }),
      "typstLibrary.link",
    ],
    ["no zip", text("not a zip"), "typstLibrary.notZip"],
  ])("refuses a package with %s", async (_, zip, error) => {
    const { instance, add } = await world();
    expect(await add(zip)).toMatchObject({ status: 400, body: { error } });
    expect(existsSync(typstLibrary(instance.config))).toBe(false);
  });

  it("keeps Typst Universe's namespace for Typst Universe", async () => {
    const { add } = await world();
    const zip = zipSync({ "typst.toml": toml("cetz", "0.3.0") });
    expect(await add(zip, "preview")).toMatchObject({ status: 400, body: { error: "typstLibrary.invalidNamespace" } });
    expect(await add(zip, "../x")).toMatchObject({ status: 400, body: { error: "typstLibrary.invalidNamespace" } });
  });

  it("are removed by admins, version by version", async () => {
    const { instance, admin, add } = await world();
    await add(zipSync({ "typst.toml": toml("assessio", "0.1.0") }));
    expect((await admin.c.raw("DELETE", "/api/instance/typst-packages/local/assessio/0.1.0")).status).toBe(200);
    expect((await admin.c.get("/api/instance/typst-packages")).body.packages).toEqual([]);
    expect(existsSync(path.join(typstLibrary(instance.config), "local"))).toBe(false);
    expect((await admin.c.raw("DELETE", "/api/instance/typst-packages/local/assessio/0.1.0")).status).toBe(404);
    expect((await admin.c.raw("DELETE", "/api/instance/typst-packages/local/..%2F..%2Fx/0.1.0")).status).toBe(404);
  });

  it("are not for teachers to change or list", async () => {
    const { teacher, add } = await world();
    expect((await add(zipSync({ "typst.toml": toml("x", "1.0.0") }), "local", teacher)).status).toBe(403);
    expect((await teacher.c.get("/api/instance/typst-packages")).status).toBe(403);
    expect((await teacher.c.raw("DELETE", "/api/instance/typst-packages/local/x/1.0.0")).status).toBe(403);
  });
});

describe("completing #import in the editor", () => {
  it("lists the instance's packages to a book's members", async () => {
    const { instance, admin, teacher, add } = await world();
    await add(zipSync({ "typst.toml": toml("assessio", "0.1.0") }));
    const book = (await teacher.c.post("/api/books", { title: "B", slug: "b" })).body;
    expect((await teacher.c.get(`/api/books/${book.id}/typst-packages`)).body).toEqual({ imports: ["@local/assessio:0.1.0"] });
    // Not to anyone else.
    const other = await loggedIn(instance, { email: "o@example.org" });
    expect((await other.c.get(`/api/books/${book.id}/typst-packages`)).status).toBe(404);
    void admin;
  });

  it("offers the shared and the book's own packages after #import \"@", async () => {
    const { EditorState } = await import("@codemirror/state");
    const { CompletionContext } = await import("@codemirror/autocomplete");
    const { setBookFilesForTypstImports, setSharedTypstImports, typstImportCompletion } = await import(
      "../src/web/pages/editor/typst-imports"
    );
    setSharedTypstImports(["@local/assessio:0.1.0"]);
    setBookFilesForTypstImports(["typst-packages/local/vorlage/1.0.0/typst.toml", "typst-packages/preview/cetz/0.3.0/typst.toml", "book/a.typ"]);
    const complete = (doc: string) => {
      const state = EditorState.create({ doc, extensions: [typstImportCompletion] });
      const [source] = state.languageDataAt<(c: InstanceType<typeof CompletionContext>) => any>("autocomplete", doc.length);
      return source!(new CompletionContext(state, doc.length, true));
    };
    const result = complete('#import "@lo');
    expect(result.from).toBe(9);
    expect(result.options.map((o: { label: string }) => o.label)).toEqual(["@local/assessio:0.1.0", "@local/vorlage:1.0.0"]);
    expect(complete("#let x = 1")).toBeNull();
  });
});

describe("the instance's Typst fonts", () => {
  const sans = readFileSync(path.join(__dirname, "../../../packages/markdown/assets/math/fonts/KaTeX_SansSerif-Regular.ttf"));

  async function fonts() {
    const { instance, admin, teacher } = await world();
    const add = async (bytes: Uint8Array, name = "KaTeX_SansSerif-Regular.ttf", as = admin) => {
      const form = new FormData();
      form.append("file", new File([bytes as BlobPart], name, { type: "font/ttf" }));
      const res = await instance.app.request("/api/instance/typst-fonts", {
        method: "POST",
        headers: { host: ADMIN_HOST, origin: ADMIN_ORIGIN, cookie: as.c.cookie },
        body: form,
      });
      return { status: res.status, body: await res.json() };
    };
    return { instance, admin, teacher, add };
  }

  it("reads the family a document names", () => {
    expect(fontNames(sans)).toEqual({ family: "KaTeX_SansSerif", style: "Regular" });
    expect(fontNames(Buffer.from("nonsense"))).toEqual({ family: null, style: null });
  });

  it("are added by admins and listed with their family", async () => {
    const { instance, admin, add } = await fonts();
    expect(await add(sans)).toMatchObject({ status: 200, body: { file: "KaTeX_SansSerif-Regular.ttf", family: "KaTeX_SansSerif" } });
    expect(existsSync(path.join(typstFonts(instance.config), "KaTeX_SansSerif-Regular.ttf"))).toBe(true);
    expect((await admin.c.get("/api/instance/typst-fonts")).body.fonts).toEqual([
      { file: "KaTeX_SansSerif-Regular.ttf", family: "KaTeX_SansSerif", style: "Regular", bytes: sans.length },
    ]);
    const actions = instance.db.select().from(auditLog).all().map((e) => e.action);
    expect(actions).toContain("instance.typstFontAdd");
  });

  it("never replaces a file", async () => {
    const { add } = await fonts();
    await add(sans);
    expect(await add(sans, "katex_sansserif-regular.TTF")).toMatchObject({ status: 409, body: { error: "typstFonts.exists" } });
  });

  it.each([
    ["no font", text("not a font at all"), "x.ttf", "typstFonts.notFont"],
    ["another extension", sans, "x.woff2", "typstFonts.invalidName"],
    ["a hidden name", sans, ".x.ttf", "typstFonts.invalidName"],
  ])("refuses %s", async (_, bytes, name, error) => {
    const { instance, add } = await fonts();
    expect(await add(bytes, name)).toMatchObject({ status: 400, body: { error } });
    expect(existsSync(path.join(typstFonts(instance.config), name))).toBe(false);
  });

  it("keeps a path in the file name out of the folder's way", async () => {
    const { instance, add } = await fonts();
    expect(await add(sans, "../../evil.ttf")).toMatchObject({ status: 200, body: { file: "evil.ttf" } });
    expect(existsSync(path.join(typstFonts(instance.config), "evil.ttf"))).toBe(true);
  });

  it("are removed by admins", async () => {
    const { admin, add } = await fonts();
    await add(sans);
    expect((await admin.c.raw("DELETE", "/api/instance/typst-fonts/KaTeX_SansSerif-Regular.ttf")).status).toBe(200);
    expect((await admin.c.get("/api/instance/typst-fonts")).body.fonts).toEqual([]);
    expect((await admin.c.raw("DELETE", "/api/instance/typst-fonts/KaTeX_SansSerif-Regular.ttf")).status).toBe(404);
    expect((await admin.c.raw("DELETE", "/api/instance/typst-fonts/..%2Fx.ttf")).status).toBe(404);
  });

  it("are not for teachers to change or list", async () => {
    const { teacher, add } = await fonts();
    expect((await add(sans, "x.ttf", teacher)).status).toBe(403);
    expect((await teacher.c.get("/api/instance/typst-fonts")).status).toBe(403);
    expect((await teacher.c.raw("DELETE", "/api/instance/typst-fonts/x.ttf")).status).toBe(403);
  });
});
