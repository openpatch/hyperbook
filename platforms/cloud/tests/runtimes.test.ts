import { existsSync, mkdtempSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { create } from "tar";
import { describe, expect, it } from "vitest";
import { builds } from "../src/server/db/schema";
import {
  assetCacheDir,
  cliRuntimeManifest,
  ensureRuntime,
  pruneAssetCache,
  pruneSharedRuntimes,
  sharedAssetsBaseFor,
  sharedRuntimesDir,
} from "../src/server/hosting/runtimes";
import { setup } from "./helpers";

const text = (s: string) => new TextEncoder().encode(s);

/**
 * A Hyperbook CLI that only exists on disk as far as the platform cares:
 * its manifest and the runtime archives its own build would pack. The real
 * one is exercised by the sandboxed build tests.
 */
async function fakeCli(elements: string[], version = "9.9.9") {
  const root = mkdtempSync(path.join(os.tmpdir(), "cloud-cli-"));
  const cli = path.join(root, "dist", "index.js");
  await mkdir(path.dirname(cli), { recursive: true });
  await writeFile(cli, "// not run");

  const bundles: Record<
    string,
    {
      url: string;
      sha256: string;
      bytes: number;
      files: Record<string, number>;
    }
  > = {};
  for (const element of elements) {
    const input = path.join(root, "input");
    await mkdir(path.join(input, `directive-${element}`), { recursive: true });
    await writeFile(
      path.join(input, `directive-${element}`, "player.html"),
      "player",
    );
    await mkdir(path.join(root, ".cache", "asset-bundles", version), {
      recursive: true,
    });
    await create(
      {
        file: path.join(
          root,
          ".cache",
          "asset-bundles",
          version,
          `${element}.tar.gz`,
        ),
        cwd: input,
        gzip: true,
      },
      [`directive-${element}`],
    );
    bundles[element] = {
      url: `https://example.com/${element}.tar.gz`,
      sha256: createHash("sha256").update(element).digest("hex"),
      bytes: 100,
      files: { [`directive-${element}/player.html`]: 6 },
    };
  }
  await writeFile(
    path.join(path.dirname(cli), "asset-manifest.json"),
    JSON.stringify({ format: 1, version, bundles }),
  );
  return cli;
}

/** An instance whose CLI is the fake one, with a published book. */
async function world(elements: string[], version = "9.9.9") {
  const cli = await fakeCli(elements, version);
  const instance = setup({ HYPERBOOK_CLI: cli });
  const owner = await (
    await import("./helpers")
  ).loggedIn(instance, { email: "o@example.org" });
  const book = (
    await owner.c.post("/api/books", { title: "Physics", slug: "physics" })
  ).body;
  const { zipSync } = await import("fflate");
  await owner.c.upload(
    `/api/books/${book.id}/source`,
    zipSync({
      "hyperbook.json": text("{}"),
      "index.html": text("<h1>Home</h1>"),
    }),
  );
  await instance.builds.idle();
  const get = (
    path: string,
    hostOrHeaders: string | Record<string, string> = "physics.books.test",
  ) =>
    typeof hostOrHeaders === "string"
      ? instance.app.request(path, { headers: { host: hostOrHeaders } })
      : instance.app.request(path, {
          headers: { host: "physics.books.test", ...hostOrHeaders },
        });
  return { instance, book, cli, version, get };
}

describe("shared element runtimes", () => {
  it("offers the instance's address when every archive is there", async () => {
    const { instance, version } = await world(["blockflow"]);
    expect(sharedAssetsBaseFor(instance.config)).toBe(
      `/_hyperbook/assets/${version}/`,
    );
    expect(cliRuntimeManifest(instance.config)?.elements).toEqual([
      "blockflow",
    ]);

    // An element the admin switched to its public CDN is not served locally;
    // with nothing left to serve, builds run like before the shared runtimes.
    expect(sharedAssetsBaseFor(instance.config, ["blockflow"])).toBeNull();

    // A CLI without a manifest, or with an archive missing, builds like before.
    const empty = await fakeCli(["blockflow"]);
    await rm(path.join(path.dirname(empty), "..", ".cache"), {
      recursive: true,
      force: true,
    });
    const bare = {
      ...instance.config,
      build: { ...instance.config.build, cli: empty },
    };
    expect(sharedAssetsBaseFor(bare)).toBeNull();
  });

  it("extracts an element on first use and serves it, immutable, on every host", async () => {
    const { instance, version, get } = await world(["blockflow"]);

    // Not extracted yet: the request extracts it.
    const res = await get(
      `/_hyperbook/assets/${version}/directive-blockflow/player.html`,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("player");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    const etag = res.headers.get("etag")!;
    expect(
      (
        await get(
          `/_hyperbook/assets/${version}/directive-blockflow/player.html`,
          { "if-none-match": etag } as any,
        )
      ).status,
    ).toBe(304);

    // The preview host serves them as well, without a login.
    expect(
      (
        await get(
          `/_hyperbook/assets/${version}/directive-blockflow/player.html`,
          "physics--preview.books.test",
        )
      ).status,
    ).toBe(200);

    // Nothing else is: no other version, no other element, no paths outside.
    expect(
      (await get(`/_hyperbook/assets/1.0.0/directive-blockflow/player.html`))
        .status,
    ).toBe(404);
    expect(
      (await get(`/_hyperbook/assets/${version}/directive-pyide/pyodide.js`))
        .status,
    ).toBe(404);
    expect(
      (
        await get(
          `/_hyperbook/assets/${version}/directive-blockflow/../../database.sqlite`,
        )
      ).status,
    ).toBe(404);
    expect((await get(`/_hyperbook/assets/${version}`)).status).toBe(404);
  });

  it("keeps extracting instead of trusting a partial extraction", async () => {
    const { instance, version } = await world(["blockflow"]);
    const runtime = await ensureRuntime(instance.config, version, "blockflow");
    expect(runtime).toBe(
      path.join(
        sharedRuntimesDir(instance.config, version),
        "directive-blockflow",
      ),
    );
    expect(await readFile(path.join(runtime!, "player.html"), "utf8")).toBe(
      "player",
    );

    // An interrupted extraction (no marker) is redone.
    await rm(path.join(runtime!, ".complete"), { force: true });
    expect(await ensureRuntime(instance.config, version, "blockflow")).toBe(
      runtime,
    );
    expect(existsSync(path.join(runtime!, ".complete"))).toBe(true);

    // Unknown versions and elements have nothing to extract from.
    expect(
      await ensureRuntime(instance.config, "1.0.0", "blockflow"),
    ).toBeNull();
    expect(await ensureRuntime(instance.config, version, "pyide")).toBeNull();
  });

  it("prunes versions no kept build was made with", async () => {
    const { instance, book, version } = await world(["blockflow"]);
    const root = path.join(instance.config.dataDir, "shared-runtimes");
    // The current version exists once something extracted it.
    await mkdir(sharedRuntimesDir(instance.config, version), {
      recursive: true,
    });
    for (const v of ["1.0.0", "2.0.0"]) {
      await mkdir(sharedRuntimesDir(instance.config, v), { recursive: true });
      await writeFile(
        path.join(sharedRuntimesDir(instance.config, v), "directive-blockflow"),
        "",
      );
    }
    instance.db
      .insert(builds)
      .values({
        bookId: book.id,
        commit: "abc",
        trigger: "upload",
        publish: false,
        status: "succeeded",
        hyperbookVersion: "1.0.0",
      })
      .run();

    pruneSharedRuntimes(instance.db, instance.config);
    expect(existsSync(sharedRuntimesDir(instance.config, version))).toBe(true);
    expect(existsSync(sharedRuntimesDir(instance.config, "1.0.0"))).toBe(true);
    expect(existsSync(sharedRuntimesDir(instance.config, "2.0.0"))).toBe(false);
  });

  it("prunes download cache entries of other Hyperbook versions", async () => {
    const { instance, version } = await world(["blockflow"]);
    const manifest = cliRuntimeManifest(instance.config)!;
    const cache = assetCacheDir(instance.config);
    for (const sha of [...manifest.shas, "f".repeat(64)]) {
      await mkdir(path.join(cache, sha), { recursive: true });
    }
    await pruneAssetCache(instance.config);
    for (const sha of manifest.shas)
      expect(existsSync(path.join(cache, sha))).toBe(true);
    expect(existsSync(path.join(cache, "f".repeat(64)))).toBe(false);
  });
});
