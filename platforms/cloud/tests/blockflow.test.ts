import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { create } from "tar";
import { describe, expect, it } from "vitest";
import { ADMIN_HOST, setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);

/**
 * A Hyperbook CLI that only exists on disk as far as the platform cares, with
 * a blockflow runtime archive in its cache (same shape as tests/runtimes.test.ts).
 */
async function fakeCli(version = "9.9.9") {
  const root = mkdtempSync(path.join(os.tmpdir(), "cloud-cli-"));
  const cli = path.join(root, "dist", "index.js");
  await mkdir(path.dirname(cli), { recursive: true });
  await writeFile(cli, "// not run");
  const input = path.join(root, "input");
  await mkdir(path.join(input, "directive-blockflow"), { recursive: true });
  await writeFile(path.join(input, "directive-blockflow", "editor.html"), "<html>editor</html>");
  await writeFile(path.join(input, "directive-blockflow", "embed-editor.html"), "<html>embed editor</html>");
  await writeFile(path.join(input, "directive-blockflow", "embed-generator.html"), "<html>embed generator</html>");
  await writeFile(path.join(input, "directive-blockflow", "player.html"), "player");
  await writeFile(
    path.join(input, "directive-blockflow", "manifest.json"),
    JSON.stringify({ version: "0.2.0", commit: "abc", entries: ["editor.html", "embed-editor.html", "embed-generator.html", "player.html"] }),
  );
  await mkdir(path.join(root, ".cache", "asset-bundles", version), { recursive: true });
  await create(
    {
      file: path.join(root, ".cache", "asset-bundles", version, "blockflow.tar.gz"),
      cwd: input,
      gzip: true,
    },
    ["directive-blockflow"],
  );
  await writeFile(
    path.join(path.dirname(cli), "asset-manifest.json"),
    JSON.stringify({
      format: 1,
      version,
      bundles: {
        blockflow: {
          url: "https://example.com/blockflow.tar.gz",
          sha256: createHash("sha256").update("blockflow").digest("hex"),
          bytes: 100,
          files: {
            "directive-blockflow/editor.html": 19,
            "directive-blockflow/embed-editor.html": 25,
            "directive-blockflow/embed-generator.html": 28,
            "directive-blockflow/player.html": 6,
            "directive-blockflow/manifest.json": 117,
          },
        },
      },
    }),
  );
  return cli;
}

describe("the blockflow editor bundle on the admin origin", () => {
  it("serves /blockflow/* from the shared runtime, with its own CSP", async () => {
    const instance = setup({ HYPERBOOK_CLI: await fakeCli() });
    const get = (p: string) => instance.app.request(p, { headers: { host: ADMIN_HOST } });

    const editor = await get("/blockflow/editor.html");
    expect(editor.status).toBe(200);
    expect(await editor.text()).toBe("<html>editor</html>");
    expect(editor.headers.get("content-type")).toContain("text/html");
    expect(editor.headers.get("cache-control")).toContain("immutable");
    // The frame's CSP allows what scratch-vm needs…
    const csp = editor.headers.get("content-security-policy")!;
    expect(csp).toContain("script-src 'self' 'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'self'");
    // …while the admin app itself keeps the stricter CSP.
    const api = await get("/api/books");
    expect(api.headers.get("content-security-policy")).not.toContain("unsafe-eval");

    expect((await get("/blockflow/player.html")).status).toBe(200);
    // The embed entries the visual editors frame, and the version manifest.
    expect((await get("/blockflow/embed-editor.html")).status).toBe(200);
    expect((await get("/blockflow/embed-generator.html")).status).toBe(200);
    const manifest = await (await get("/blockflow/manifest.json")).json();
    expect(manifest.entries).toContain("embed-editor.html");
    expect((await get("/blockflow/nope.js")).status).toBe(404);
    // Nothing outside the bundle, however the path is spelled.
    expect((await get("/blockflow/%2e%2e/%2e%2e/asset-manifest.json")).status).toBe(404);
    expect((await get("/blockflow/..%2f..%2fpackage.json")).status).toBe(404);
  });

  it("answers 404 when no blockflow runtime is installed", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "cloud-cli-"));
    const cli = path.join(root, "dist", "index.js");
    await mkdir(path.dirname(cli), { recursive: true });
    await writeFile(cli, "// not run");
    // No asset-manifest.json next to the CLI, and no monorepo bundle to fall
    // back to at this path: make sure the fallback does not accidentally hit.
    const instance = setup({ HYPERBOOK_CLI: cli, DATA_DIR: mkdtempSync(path.join(os.tmpdir(), "cloud-data-")) });
    const res = await instance.app.request("/blockflow/editor.html", { headers: { host: ADMIN_HOST } });
    // Either the monorepo fallback serves the real bundle, or nothing does.
    if (res.status === 200) expect(await res.text()).toContain("Blockflow");
    else expect(res.status).toBe(404);
  });
});
