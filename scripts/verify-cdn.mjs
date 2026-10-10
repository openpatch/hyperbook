import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releasePrefix, runtimeManifest } from "./publish-cdn.mjs";

// Read through the public hostname, exercising the path browsers actually use.
export async function verifyCdn({
  element,
  version,
  directory,
  fetchImpl = fetch,
}) {
  const base = `https://cdn.openpatch.org/${releasePrefix(element, version)}/`;
  const expected = await runtimeManifest(directory);
  async function get(relative) {
    const response = await fetchImpl(new URL(relative, base), {
      headers: { Origin: "https://hyperbook.openpatch.org" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
    if (response.headers.get("access-control-allow-origin") !== "*") {
      throw new Error(`${relative}: missing public CORS headers`);
    }
    if (!response.headers.get("cache-control")?.includes("immutable")) {
      throw new Error(`${relative}: missing immutable Cache-Control`);
    }
    return response;
  }
  const manifest = await (await get("manifest.json")).json();
  if (JSON.stringify(manifest) !== JSON.stringify(expected))
    throw new Error("Public CDN manifest differs from the release");
  const files = Object.entries(expected.files);
  let next = 0;
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(4, files.length) }, async () => {
      while (next < files.length) {
        const [relative, metadata] = files[next++];
        const response = await get(relative);
        if (
          response.headers.get("content-type")?.split(";")[0] !==
          metadata.contentType
        ) {
          throw new Error(`${relative}: incorrect Content-Type`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        if (
          bytes.length !== metadata.bytes ||
          createHash("sha256").update(bytes).digest("hex") !== metadata.sha256
        ) {
          throw new Error(`${relative}: public CDN checksum mismatch`);
        }
      }
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  console.log(
    `Verified ${files.length} public CDN files, CORS, MIME types and immutable caching at ${base}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [element, version, directory] = process.argv.slice(2);
  await verifyCdn({ element, version, directory });
}
