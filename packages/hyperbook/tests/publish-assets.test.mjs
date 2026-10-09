import { beforeEach, afterEach, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { publishAssets } from "../publish-assets.mjs";

let root, fetchImpl, ghImpl, uploaded;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-publish-assets-"));
  await fs.mkdir(path.join(root, "dist"));
  await fs.mkdir(path.join(root, ".cache", "asset-bundles", "1.0.0"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ version: "1.0.0" }),
  );
  const data = Buffer.from("bundle");
  const sha256 = createHash("sha256").update(data).digest("hex");
  await fs.writeFile(
    path.join(root, ".cache", "asset-bundles", "1.0.0", "blockflow.tar.gz"),
    data,
  );
  await fs.writeFile(
    path.join(root, "dist", "asset-manifest.json"),
    JSON.stringify({
      version: "1.0.0",
      bundles: { blockflow: { sha256, bytes: data.length } },
    }),
  );
  uploaded = {
    draft: true,
    assets: [
      {
        name: "blockflow.tar.gz",
        size: data.length,
        digest: `sha256:${sha256}`,
      },
    ],
  };
  fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
  ghImpl = vi.fn((...args) => {
    if (args[0] === "api" && args.includes("--slurp")) return "[[]]";
    if (args[0] === "api") return JSON.stringify(uploaded);
    return "";
  });
});

afterEach(async () => fs.rm(root, { recursive: true, force: true }));

it("publishes a draft only after every uploaded checksum matches the CLI", async () => {
  await publishAssets({ packagePath: root, fetchImpl, ghImpl });
  const calls = ghImpl.mock.calls;
  expect(
    calls.find((args) => args[0] === "release" && args[1] === "create"),
  ).toContain("--draft");
  expect(calls.findIndex((args) => args[1] === "upload")).toBeLessThan(
    calls.findIndex((args) => args[1] === "edit"),
  );
  expect(calls.at(-1)).toEqual([
    "release",
    "edit",
    "hyperbook-assets-v1.0.0",
    "--repo",
    "openpatch/hyperbook",
    "--draft=false",
  ]);
});

it("blocks publication when the uploaded bundle is corrupt", async () => {
  uploaded.assets[0].digest = "sha256:wrong";
  await expect(
    publishAssets({ packagePath: root, fetchImpl, ghImpl }),
  ).rejects.toThrow("Uploaded asset does not match");
  expect(ghImpl.mock.calls.some((args) => args[1] === "edit")).toBe(false);
});

it("blocks upload when local archives no longer match the built CLI", async () => {
  await fs.writeFile(
    path.join(root, ".cache", "asset-bundles", "1.0.0", "blockflow.tar.gz"),
    "changed",
  );
  await expect(
    publishAssets({ packagePath: root, fetchImpl, ghImpl }),
  ).rejects.toThrow("no longer matches");
  expect(ghImpl).not.toHaveBeenCalled();
});

it("leaves an already published CLI version's assets alone", async () => {
  fetchImpl.mockResolvedValue(new Response("published"));
  await publishAssets({ packagePath: root, fetchImpl, ghImpl });
  expect(ghImpl).not.toHaveBeenCalled();
});

it("fails closed when the npm registry check fails", async () => {
  fetchImpl.mockResolvedValue(new Response("unavailable", { status: 503 }));
  await expect(
    publishAssets({ packagePath: root, fetchImpl, ghImpl }),
  ).rejects.toThrow("HTTP 503");
  expect(ghImpl).not.toHaveBeenCalled();
});
