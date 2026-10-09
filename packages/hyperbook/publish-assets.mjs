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
    // Filter inside gh so the release history cannot fill execFileSync's buffer.
    const releaseJson = gh(
      "api",
      "--paginate",
      `repos/${repo}/releases?per_page=100`,
      "--jq",
      `.[] | select(.tag_name == ${JSON.stringify(tag)}) | {id, draft}`,
    ).trim();
    let release = releaseJson ? JSON.parse(releaseJson) : null;
    if (!release) {
      release = JSON.parse(
        gh(
          "api",
          `repos/${repo}/releases`,
          "--method",
          "POST",
          "--raw-field",
          `tag_name=${tag}`,
          "--raw-field",
          `target_commitish=${process.env.GITHUB_SHA || "main"}`,
          "--raw-field",
          `name=Hyperbook ${version} assets`,
          "--raw-field",
          `body=Optional browser assets for hyperbook@${version}. The CLI verifies the SHA-256 checksums before using these bundles.`,
          "--field",
          "draft=true",
          "--jq",
          "{id, draft}",
        ),
      );
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
    // GitHub's tag endpoint only returns published releases, so verify drafts by ID.
    const uploaded = JSON.parse(
      gh("api", `repos/${repo}/releases/${release.id}`),
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
