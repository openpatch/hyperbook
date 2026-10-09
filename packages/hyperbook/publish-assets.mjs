import { execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

export async function publishAssets({
  packagePath = path.dirname(fileURLToPath(import.meta.url)),
  fetchImpl = fetch,
  ghImpl,
} = {}) {
  const pkg = packagePath;
  const { version } = JSON.parse(
    await readFile(path.join(pkg, "package.json"), "utf8"),
  );
  const response = await fetchImpl(
    `https://registry.npmjs.org/hyperbook/${version}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (response.ok) {
    console.log(
      `hyperbook@${version} is already published; skipping asset publication.`,
    );
  } else {
    if (response.status !== 404)
      throw new Error(
        `Could not check npm publication: HTTP ${response.status}`,
      );
    const manifest = JSON.parse(
      await readFile(path.join(pkg, "dist", "asset-manifest.json"), "utf8"),
    );
    if (manifest.version !== version)
      throw new Error("Rebuild the CLI before publishing its assets.");
    const tag = `hyperbook-assets-v${version}`;
    const repo = "openpatch/hyperbook";
    const gh =
      ghImpl ||
      ((...args) =>
        execFileSync("gh", args, {
          encoding: "utf8",
          env: {
            ...process.env,
            GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
          },
        }));
    const filename = (name) =>
      path.join(pkg, ".cache", "asset-bundles", version, `${name}.tar.gz`);
    for (const [name, bundle] of Object.entries(manifest.bundles)) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(filename(name)))
        hash.update(chunk);
      if (hash.digest("hex") !== bundle.sha256)
        throw new Error(
          `Asset bundle no longer matches the CLI manifest: ${name}`,
        );
    }

    // List rather than treating every failed API request as a nonexistent release.
    const releases = JSON.parse(
      gh("api", "--paginate", "--slurp", `repos/${repo}/releases`),
    ).flat();
    let release = releases.find((entry) => entry.tag_name === tag);
    if (!release) {
      gh(
        "release",
        "create",
        tag,
        "--repo",
        repo,
        "--draft",
        "--target",
        process.env.GITHUB_SHA || "main",
        "--title",
        `Hyperbook ${version} assets`,
        "--notes",
        `Optional browser assets for hyperbook@${version}. The CLI verifies the SHA-256 checksums before using these bundles.`,
      );
      release = { draft: true };
    }
    if (release.draft) {
      gh(
        "release",
        "upload",
        tag,
        "--repo",
        repo,
        "--clobber",
        ...Object.keys(manifest.bundles).map(filename),
      );
    }
    const uploaded = JSON.parse(
      gh("api", `repos/${repo}/releases/tags/${tag}`),
    );
    for (const [name, bundle] of Object.entries(manifest.bundles)) {
      const asset = uploaded.assets.find(
        (entry) => entry.name === `${name}.tar.gz`,
      );
      if (
        !asset ||
        asset.size !== bundle.bytes ||
        asset.digest !== `sha256:${bundle.sha256}`
      ) {
        throw new Error(
          `Uploaded asset does not match the CLI manifest: ${name}`,
        );
      }
    }
    if (uploaded.draft)
      gh("release", "edit", tag, "--repo", repo, "--draft=false");
    console.log(`Assets for hyperbook@${version} are published and verified.`);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await publishAssets();
