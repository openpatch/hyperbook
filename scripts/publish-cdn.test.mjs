import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  publishCdn,
  releasePrefix,
  runtimeManifest,
  wranglerStore,
} from "./publish-cdn.mjs";
import { verifyCdn } from "./verify-cdn.mjs";

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cdn-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, "include", "assets"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(directory, "include", "online-ide-embedded.js"),
    "export const version = 1;",
  );
  await fs.writeFile(
    path.join(directory, "include", "assets", "runtime.wasm"),
    Buffer.from([0, 97, 115, 109]),
  );
  await fs.writeFile(
    path.join(directory, "include", "example.html"),
    "example",
  );
  await fs.writeFile(
    path.join(directory, "include", "bundle.js.map"),
    "source map",
  );
  const objects = new Map([
    ["sqlide/v1/unchanged.js", Buffer.from("existing SQL release")],
  ]);
  const writes = [];
  const store = {
    get: async (key) => objects.get(key) || null,
    async put(key, file, type) {
      writes.push({ key, type });
      objects.set(key, await fs.readFile(file));
    },
  };
  return {
    directory,
    objects,
    writes,
    store,
    element: "onlineide",
    version: "v1",
  };
}

test("publishes workers/WASM with correct MIME types, skips maps and HTML, and marks completion last", async (t) => {
  const f = await fixture(t);
  const manifest = await publishCdn(f);
  assert.equal(f.writes.at(-1).key, "onlineide/v1/manifest.json");
  assert.equal(
    f.writes.find((write) => write.key.endsWith(".js")).type,
    "text/javascript",
  );
  assert.equal(
    f.writes.find((write) => write.key.endsWith(".wasm")).type,
    "application/wasm",
  );
  assert.equal(Object.keys(manifest.files).length, 2);
  assert.equal(
    manifest.files["include/assets/runtime.wasm"].sha256,
    createHash("sha256")
      .update(Buffer.from([0, 97, 115, 109]))
      .digest("hex"),
  );
  assert.equal(
    f.objects.get("sqlide/v1/unchanged.js").toString(),
    "existing SQL release",
  );
});

test("retrying a completed release performs no writes; changed releases cannot replace it", async (t) => {
  const f = await fixture(t);
  await publishCdn(f);
  const writes = f.writes.length;
  await publishCdn(f);
  assert.equal(f.writes.length, writes);
  await fs.writeFile(
    path.join(f.directory, "include", "online-ide-embedded.js"),
    "changed",
  );
  await assert.rejects(publishCdn(f), /immutable/);
  assert.equal(f.writes.length, writes);
});

test("failed publication leaves no completion marker and can resume existing payload files", async (t) => {
  const f = await fixture(t);
  const put = f.store.put;
  f.store.put = async (key, ...args) => {
    if (key.endsWith(".wasm")) throw new Error("Upload failed");
    await put(key, ...args);
  };
  await assert.rejects(publishCdn(f), /Upload failed/);
  assert.equal(f.objects.has("onlineide/v1/manifest.json"), false);
  f.store.put = put;
  await publishCdn(f);
  assert.equal(f.objects.has("onlineide/v1/manifest.json"), true);
});

test("a conflicting object in a partial release is never overwritten", async (t) => {
  const f = await fixture(t);
  f.objects.set(
    "onlineide/v1/include/assets/runtime.wasm",
    Buffer.from("different"),
  );
  await assert.rejects(publishCdn(f), /Existing runtime object differs/);
  assert.equal(
    f.objects.get("onlineide/v1/include/assets/runtime.wasm").toString(),
    "different",
  );
  assert.equal(f.objects.has("onlineide/v1/manifest.json"), false);
});

test("new versions retain all objects from prior versions", async (t) => {
  const f = await fixture(t);
  await publishCdn(f);
  const previous = new Map(f.objects);
  await publishCdn({ ...f, version: "v2" });
  for (const [key, value] of previous)
    assert.deepEqual(f.objects.get(key), value);
});

test("unsafe namespaces, empty runtimes, reserved metadata and symlinks are rejected", async (t) => {
  for (const version of ["../x", "/x", "..", "latest", "v1?x", "v1/x"]) {
    assert.throws(() => releasePrefix("onlineide", version));
  }
  assert.throws(() => releasePrefix("unknown", "v1"));
  const f = await fixture(t);
  const empty = path.join(f.directory, "empty");
  await fs.mkdir(empty);
  await assert.rejects(runtimeManifest(empty), /No runtime files/);
  await fs.writeFile(path.join(f.directory, "manifest.json"), "reserved");
  await assert.rejects(runtimeManifest(f.directory), /reserved/);
  await fs.rm(path.join(f.directory, "manifest.json"));
  await fs.symlink(
    "include/assets/runtime.wasm",
    path.join(f.directory, "link"),
  );
  await assert.rejects(runtimeManifest(f.directory), /symlink/);
});

test("Wrangler uploads to remote R2 with immutable caching and treats only missing keys as absent", async () => {
  const calls = [];
  const store = wranglerStore("cdn", async (command, args) => {
    calls.push({ command, args });
  });
  await store.put(
    "onlineide/v1/include/worker.js",
    "/tmp/worker.js",
    "text/javascript",
  );
  assert.equal(calls[0].command, "wrangler");
  assert.deepEqual(calls[0].args, [
    "r2",
    "object",
    "put",
    "cdn/onlineide/v1/include/worker.js",
    "--remote",
    "--file",
    "/tmp/worker.js",
    "--content-type",
    "text/javascript",
    "--cache-control",
    "public, max-age=31536000, immutable",
  ]);
  const missing = wranglerStore("cdn", async () => {
    throw { stderr: "The specified key does not exist." };
  });
  assert.equal(await missing.get("absent"), null);
  const denied = wranglerStore("cdn", async () => {
    throw new Error("Authentication failed");
  });
  await assert.rejects(denied.get("absent"), /Authentication failed/);
});

test("public verification checks all payloads and fails for bad CORS, cache, MIME types and checksums", async (t) => {
  const f = await fixture(t);
  const manifest = await publishCdn(f);
  let fault;
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Origin, "https://hyperbook.openpatch.org");
    const key = new URL(url).pathname.slice(1);
    const relative = key.slice("onlineide/v1/".length);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type":
        manifest.files[relative]?.contentType || "application/json",
    };
    if (fault === "CORS") delete headers["Access-Control-Allow-Origin"];
    if (fault === "Cache-Control") delete headers["Cache-Control"];
    if (fault === "Content-Type" && relative !== "manifest.json")
      headers["Content-Type"] = "text/plain";
    return new Response(
      fault === "checksum" && relative !== "manifest.json"
        ? "corrupt"
        : f.objects.get(key),
      { headers },
    );
  };
  await verifyCdn({ ...f, fetchImpl });
  for (fault of ["CORS", "Cache-Control", "Content-Type", "checksum"]) {
    await assert.rejects(
      verifyCdn({ ...f, fetchImpl }),
      /CORS|Cache-Control|Content-Type|checksum/,
    );
  }
});
