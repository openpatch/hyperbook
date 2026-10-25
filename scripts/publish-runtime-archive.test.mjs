import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { publishRuntimeArchives } from "./publish-runtime-archive.mjs";

function archiveAsset(name, content, element, version) {
  const upstream = {
    geogebra: "https://download.geogebra.org/installers/5.4",
    openscad: "https://ochafik.com/openscad2/libraries",
  }[element];
  return {
    url: `https://cdn.openpatch.org/runtime-archives/${element}/${version}/${name}`,
    upstreamUrl: `${upstream}/${name}`,
    version,
    sha256: createHash("sha256").update(content).digest("hex"),
    bytes: content.length,
    format: "file",
    target:
      element === "openscad"
        ? `directive-openscad/libraries/${name}`
        : `directive-${element}`,
  };
}

async function fixture(t) {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-archive-"));
  t.after(() => fs.rm(cacheDir, { recursive: true, force: true }));
  const bytes = {
    "geogebra-math-apps-bundle-5-4-931-2.zip": Buffer.from("geogebra bundle"),
    "BOSL2.zip": Buffer.from("BOSL2 library"),
    "fonts.zip": Buffer.from("openscad fonts"),
  };
  const assets = [
    archiveAsset(
      "geogebra-math-apps-bundle-5-4-931-2.zip",
      bytes["geogebra-math-apps-bundle-5-4-931-2.zip"],
      "geogebra",
      "5.4.931.2",
    ),
    archiveAsset("BOSL2.zip", bytes["BOSL2.zip"], "openscad", "2026.10.08"),
    archiveAsset("fonts.zip", bytes["fonts.zip"], "openscad", "2026.10.08"),
    {
      // Pyodide stays on its GitHub release and has no mirror.
      url: "https://github.com/pyodide/pyodide/releases/download/314.0.7/pyodide-314.0.7.tar.bz2",
      sha256:
        "192b5864e6e6d30ab074861af800cb8b4acb0998ef0f9342c3367448aeb86645",
      format: "tar.bz2",
      target: "directive-pyide",
    },
  ];
  const downloads = [];
  const writes = [];
  const objects = new Map();
  const store = {
    async get(key) {
      return objects.get(key) || null;
    },
    async put(key, file, contentType) {
      writes.push({ key, contentType });
      objects.set(key, await fs.readFile(file));
    },
  };
  return { cacheDir, bytes, assets, downloads, writes, objects, store };
}

function stubFetch(t, f, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, ...args) => {
    f.downloads.push(String(url));
    return impl(url, ...args);
  };
  t.after(() => {
    globalThis.fetch = original;
  });
}

function serve(f, url) {
  return new Response(f.bytes[new URL(url).pathname.split("/").pop()]);
}

test("publishes new releases under versioned keys and uploads the marker last", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, (url) => serve(f, url));
  await publishRuntimeArchives({
    assets: f.assets,
    store: f.store,
    cacheDir: f.cacheDir,
  });
  assert.deepEqual(f.downloads, [
    "https://download.geogebra.org/installers/5.4/geogebra-math-apps-bundle-5-4-931-2.zip",
    "https://ochafik.com/openscad2/libraries/BOSL2.zip",
    "https://ochafik.com/openscad2/libraries/fonts.zip",
  ]);
  assert.deepEqual(
    f.writes.map((write) => [write.key, write.contentType]),
    [
      [
        "runtime-archives/geogebra/5.4.931.2/geogebra-math-apps-bundle-5-4-931-2.zip",
        "application/zip",
      ],
      ["runtime-archives/geogebra/5.4.931.2/manifest.json", "application/json"],
      ["runtime-archives/openscad/2026.10.08/BOSL2.zip", "application/zip"],
      ["runtime-archives/openscad/2026.10.08/fonts.zip", "application/zip"],
      [
        "runtime-archives/openscad/2026.10.08/manifest.json",
        "application/json",
      ],
    ],
  );
  assert.deepEqual(
    JSON.parse(
      f.objects.get("runtime-archives/openscad/2026.10.08/manifest.json"),
    ),
    {
      schema: 1,
      files: {
        "BOSL2.zip": {
          sha256: createHash("sha256")
            .update(f.bytes["BOSL2.zip"])
            .digest("hex"),
          bytes: f.bytes["BOSL2.zip"].length,
          contentType: "application/zip",
        },
        "fonts.zip": {
          sha256: createHash("sha256")
            .update(f.bytes["fonts.zip"])
            .digest("hex"),
          bytes: f.bytes["fonts.zip"].length,
          contentType: "application/zip",
        },
      },
    },
  );
  assert.deepEqual(
    f.objects.get(
      "runtime-archives/geogebra/5.4.931.2/geogebra-math-apps-bundle-5-4-931-2.zip",
    ),
    f.bytes["geogebra-math-apps-bundle-5-4-931-2.zip"],
  );
});

test("an already published release is skipped without downloads or uploads", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, (url) => serve(f, url));
  await publishRuntimeArchives({
    assets: f.assets,
    store: f.store,
    cacheDir: f.cacheDir,
  });
  const writes = f.writes.length;
  const downloads = f.downloads.length;
  // A cold cache must not download from upstream just to learn that the
  // release is already on the CDN.
  const cold = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-archive-"));
  t.after(() => fs.rm(cold, { recursive: true, force: true }));
  await publishRuntimeArchives({
    assets: f.assets,
    store: f.store,
    cacheDir: cold,
  });
  assert.equal(f.writes.length, writes);
  assert.equal(f.downloads.length, downloads);
});

test("a changed marker cannot replace a published release", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, (url) => serve(f, url));
  await publishRuntimeArchives({
    assets: f.assets,
    store: f.store,
    cacheDir: f.cacheDir,
  });
  const writes = f.writes.length;
  f.objects.set(
    "runtime-archives/geogebra/5.4.931.2/manifest.json",
    Buffer.from(JSON.stringify({ schema: 1, files: {} }, null, 2) + "\n"),
  );
  await assert.rejects(
    publishRuntimeArchives({
      assets: f.assets,
      store: f.store,
      cacheDir: f.cacheDir,
    }),
    /immutable/,
  );
  assert.equal(f.writes.length, writes);
});

test("a wrong pinned archive size fails before publishing", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, (url) => serve(f, url));
  await assert.rejects(
    publishRuntimeArchives({
      assets: [{ ...f.assets[0], bytes: f.assets[0].bytes + 1 }],
      store: f.store,
      cacheDir: f.cacheDir,
    }),
    /pinned size/,
  );
  assert.deepEqual(f.writes, []);
});

test("mirror URLs must match the versioned release key", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, () => {
    throw new Error("must not download");
  });
  await assert.rejects(
    publishRuntimeArchives({
      assets: [
        {
          ...f.assets[0],
          url: "https://cdn.openpatch.org/runtime-archives/geogebra/typos/geogebra-math-apps-bundle-5-4-931-2.zip",
        },
      ],
      store: f.store,
      cacheDir: f.cacheDir,
    }),
    /release key/,
  );
  assert.deepEqual(f.writes, []);
});

test("all archives of one element must share the release version", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, () => {
    throw new Error("must not download");
  });
  await assert.rejects(
    publishRuntimeArchives({
      assets: [
        f.assets[1],
        {
          ...f.assets[2],
          version: "2026.10.09",
          url: "https://cdn.openpatch.org/runtime-archives/openscad/2026.10.09/fonts.zip",
        },
      ],
      store: f.store,
      cacheDir: f.cacheDir,
    }),
    /Inconsistent archive versions/,
  );
  assert.deepEqual(f.writes, []);
});

test("resume keeps identical objects, rejects conflicting ones, and never marks a partial release", async (t) => {
  const f = await fixture(t);
  stubFetch(t, f, (url) => serve(f, url));
  const key = "runtime-archives/openscad/2026.10.08/BOSL2.zip";
  f.objects.set(key, f.bytes["BOSL2.zip"]);
  await publishRuntimeArchives({
    assets: f.assets,
    store: f.store,
    cacheDir: f.cacheDir,
  });
  assert.equal(
    f.writes.some((write) => write.key === key),
    false,
  );
  assert.equal(
    f.objects.has("runtime-archives/openscad/2026.10.08/manifest.json"),
    true,
  );
  const g = await fixture(t);
  stubFetch(t, g, (url) => serve(g, url));
  g.objects.set(key, Buffer.from("different"));
  await assert.rejects(
    publishRuntimeArchives({
      assets: g.assets,
      store: g.store,
      cacheDir: g.cacheDir,
    }),
    /Existing runtime archive differs/,
  );
  assert.equal(
    g.objects.has("runtime-archives/openscad/2026.10.08/manifest.json"),
    false,
  );
});
