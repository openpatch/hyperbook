import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { Context } from "hono";
import { getMimeType } from "hono/utils/mime";
import { pathSegments } from "../books/serve";
import type { Config } from "../config";
import { cliRuntimeManifest, ensureRuntime, sharedRuntimesDir } from "../hosting/runtimes";
import { hyperbookVersion } from "../hosting/runner";

/*
 * The blockflow editor (the Scratch fork the blockflow directives embed in
 * books), framed by the editor's visual frame at /blockflow/ on the admin
 * origin. It is the same runtime bundle the books of this instance render
 * with: the one extracted once per Hyperbook version into
 * dataDir/shared-runtimes (see hosting/runtimes.ts), which ensureRuntime
 * unpacks on first use. In a monorepo checkout whose CLI has no cached
 * bundle yet, fall back to the one @hyperbook/markdown downloaded.
 */

/**
 * The CSP of the /blockflow/ documents only; the admin app keeps its stricter
 * one. scratch-vm compiles blocks with `new Function`, so 'unsafe-eval';
 * costumes, sounds and the stage load from the Scratch asset CDNs and from
 * blob: (the small stage is its own iframe); the VM's workers are blob:.
 */
export const BLOCKFLOW_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' data: blob: https://assets.scratch.mit.edu https://cdn.assets.scratch.mit.edu https://projects.scratch.mit.edu",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "child-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/**
 * The blockflow bundle @hyperbook/markdown vendored in its dist, in a monorepo
 * checkout: walked up from here because the bundled server (dist/server) sits
 * one level higher than the source (src/server/admin). Null in production
 * images, where only the shared runtime exists.
 */
function monorepoBundle(): string | null {
  let dir = import.meta.dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "packages/markdown/dist/assets/directive-blockflow");
    if (existsSync(path.join(candidate, "editor.html"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * The directory the blockflow bundle is served from, or null if there is none.
 * The visual editors need the embed entries (embed-editor.html,
 * embed-generator.html, blockflow >= v0.2.0), so prefer a root that has them:
 * the shared runtime of the current Hyperbook version first, then the bundle
 * vendored in the monorepo (whose CLI cache may still hold an older one).
 */
async function blockflowRoot(config: Config): Promise<string | null> {
  const roots: string[] = [];
  const version = cliRuntimeManifest(config)?.version ?? hyperbookVersion(config);
  if (version && (await ensureRuntime(config, version, "blockflow")))
    roots.push(path.join(sharedRuntimesDir(config, version), "directive-blockflow"));
  const vendored = monorepoBundle();
  if (vendored) roots.push(vendored);
  return (
    roots.find((root) => existsSync(path.join(root, "embed-editor.html"))) ??
    roots.find((root) => existsSync(path.join(root, "editor.html"))) ??
    null
  );
}

/** GET/HEAD /blockflow/*: the editor bundle, public bytes like on book hosts. */
export async function serveBlockflow(c: Context, config: Config) {
  // pathSegments decodes and rejects ".." and smuggled separators.
  const rest = pathSegments(c.req.path)?.slice(1);
  if (!rest || rest.length === 0) return c.text("Not found", 404);
  const root = await blockflowRoot(config);
  if (!root) return c.text("The blockflow editor is not installed on this instance.", 404);
  // With a pre-v0.2.0 bundle there are no embed entries; the frame reports
  // that itself when it gets no "ready" answer.
  const file = path.join(root, ...rest);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return c.text("Not found", 404);
  c.header("content-type", getMimeType(file) ?? "application/octet-stream");
  c.header("x-content-type-options", "nosniff");
  // The bundle is immutable per Hyperbook version.
  c.header("cache-control", "public, max-age=31536000, immutable");
  return c.body(Readable.toWeb(createReadStream(file)) as ReadableStream);
}
