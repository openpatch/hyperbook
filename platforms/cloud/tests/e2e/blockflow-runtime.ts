import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The e2e tests exercise the blockflow visual editors, which need the
 * blockflow v0.2.0 runtime bundle (embed-editor.html, embed-generator.html,
 * manifest.json — see packages/markdown/postbuild.mjs). The CLI checkout can
 * be read-only, so its cached asset archive may still hold the older
 * blockflow without the embed entries, and /blockflow/embed-*.html would 404.
 * This helper packs the blockflow-v0.2.0 dist-embedded.zip once per machine
 * into a cache in the OS temp dir and installs the bundle into a server's
 * dataDir/shared-runtimes/<version>/directive-blockflow (with the .complete
 * marker), which is exactly where ensureRuntime would extract it from — so
 * both /blockflow/* and /_hyperbook/assets/* serve the v0.2.0 bundle.
 */

const BLOCKFLOW_RELEASE_ZIP =
  "https://github.com/openpatch/blockflow/releases/download/blockflow-v0.2.0/dist-embedded.zip";

const root = fileURLToPath(new URL("../..", import.meta.url));
const realManifest = path.join(root, "../../packages/hyperbook/dist/asset-manifest.json");

/** One-time download/pack cache; rebuilt when the marker is missing. */
const cacheDir = path.join(tmpdir(), "hyperbook-cloud-e2e-blockflow");
const zipPath = path.join(cacheDir, "blockflow-v0.2.0.zip");
const tarPath = path.join(cacheDir, "blockflow-v0.2.0.tar.gz");

async function ensureTar(): Promise<void> {
  if (existsSync(path.join(cacheDir, ".ready"))) return;
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(zipPath)) {
    // Best effort: the sandbox proxy usually allows the GitHub release CDN.
    const res = await fetch(BLOCKFLOW_RELEASE_ZIP, { redirect: "follow" });
    if (!res.ok) throw new Error(`Could not download ${BLOCKFLOW_RELEASE_ZIP}: HTTP ${res.status}`);
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  const staging = path.join(cacheDir, "staging");
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(path.join(staging, "directive-blockflow"), { recursive: true });
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", path.join(staging, "directive-blockflow")]);
  execFileSync("tar", ["-czf", tarPath, "-C", staging, "directive-blockflow"]);
  rmSync(staging, { recursive: true, force: true });
  writeFileSync(path.join(cacheDir, ".ready"), createHash("sha256").update(readFileSync(tarPath)).digest("hex"));
}

/**
 * Installs the blockflow v0.2.0 bundle into the server's data dir, as
 * ensureRuntime would have extracted it from the CLI's asset archive.
 */
export async function installBlockflowV020(dataDir: string): Promise<void> {
  try {
    await ensureTar();
  } catch (error) {
    console.warn(`e2e: blockflow v0.2.0 bundle unavailable (${(error as Error).message}); visual-editor tests will fail`);
    return;
  }
  const version: string = JSON.parse(readFileSync(realManifest, "utf8")).version;
  const destination = path.join(dataDir, "shared-runtimes", version, "directive-blockflow");
  rmSync(path.join(dataDir, "shared-runtimes", version), { recursive: true, force: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  execFileSync("tar", ["-xzf", tarPath, "-C", path.dirname(destination)]);
  writeFileSync(path.join(destination, ".complete"), version);
}
