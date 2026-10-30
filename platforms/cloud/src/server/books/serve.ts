import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { Context } from "hono";
import { getMimeType } from "hono/utils/mime";
import type { Config } from "../config";
import { SAFE_VERSION, ensureRuntime, sharedRuntimesDir } from "../hosting/runtimes";

/*
 * Serving a finished build: the book's address and its preview host.
 */

/**
 * The path's segments, decoded, or null when the path could reach outside the
 * build: "..", or an encoded slash or backslash smuggled into a segment.
 */
export function pathSegments(pathname: string): string[] | null {
  const segments: string[] = [];
  for (const raw of pathname.split("/")) {
    if (raw === "") continue;
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (segment === "." || segment === ".." || /[/\\\0]/.test(segment)) return null;
    segments.push(segment);
  }
  return segments;
}

/** Hyperbook's clean URLs: /page may be page.html or page/index.html. */
function candidates(segments: string[], trailingSlash: boolean): string[] {
  const base = segments.join("/");
  if (base === "" || trailingSlash) return [path.posix.join(base, "index.html")];
  return [base, `${base}.html`, `${base}/index.html`];
}

async function findFile(root: string, names: string[]) {
  for (const name of names) {
    const file = path.join(root, name);
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return { file, size: info.size };
  }
  return null;
}

/** A single "bytes=a-b" range, or null for none, or "invalid". */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

export function page(c: Context, status: 403 | 404, title: string, body: string) {
  return c.html(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 1rem;color:#333}h1{font-size:1.4rem;color:#007864}</style></head>` +
      `<body><h1>${title}</h1><p>${body}</p></body></html>`,
    status,
  );
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * Answers a GET or HEAD for `pathname` from the build in `root`, with clean
 * URLs, the build's 404.html, ETags and ranges (audio and video seeking).
 */
export async function serveBuild(
  c: Context,
  options: { root: string; pathname: string; segments: string[]; etag: string; cacheControl: string },
) {
  const { root, pathname, segments } = options;
  let status: 200 | 404 = 200;
  let found = await findFile(root, candidates(segments, pathname.endsWith("/")));
  if (!found) {
    status = 404;
    found = await findFile(root, ["404.html"]);
    if (!found) return page(c, 404, "Page not found", "This page does not exist in the book.");
  }
  return send(c, found, status, options);
}

/**
 * The element runtimes the platform extracted once per Hyperbook version, at
 * /_hyperbook/assets/<version>/directive-<element>/… on every book host. They are the
 * same public bytes a CDN would serve, so no login protects them; the version
 * in the address makes them immutable. The current version extracts a missing
 * element on first use; older versions serve what they still have.
 */
export async function serveSharedAssets(c: Context, config: Config, pathname: string) {
  const segments = pathSegments(pathname);
  const version = segments?.[2];
  const directive = segments?.[3];
  if (
    !segments ||
    segments.length < 4 ||
    segments[0] !== "_hyperbook" ||
    segments[1] !== "assets" ||
    !version ||
    !SAFE_VERSION.test(version) ||
    !directive ||
    !/^directive-[a-z0-9-]+$/.test(directive)
  )
    return c.text("Not found", 404);
  await ensureRuntime(config, version, directive.slice("directive-".length));
  const found = await serveFile(c, {
    root: sharedRuntimesDir(config, version),
    pathname,
    segments: segments.slice(3),
    etag: `shared-assets-${version}`,
    cacheControl: "public, max-age=31536000, immutable",
  });
  return found ?? c.text("Not found", 404);
}

/** A file at exactly `segments` in `root`, or null if there is none. */
export async function serveFile(
  c: Context,
  options: { root: string; pathname: string; segments: string[]; etag: string; cacheControl: string },
) {
  if (options.segments.length === 0) return null;
  const found = await findFile(options.root, [options.segments.join("/")]);
  return found ? send(c, found, 200, options) : null;
}

async function send(
  c: Context,
  found: { file: string; size: number },
  status: 200 | 404,
  options: { etag: string; cacheControl: string },
) {
  const etag = `"${options.etag}-${found.size}"`;
  c.header("etag", etag);
  c.header("cache-control", options.cacheControl);
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("content-type", getMimeType(found.file) ?? "application/octet-stream");
  c.header("accept-ranges", "bytes");

  if (status === 200 && c.req.header("if-none-match") === etag) {
    return c.body(null, 304);
  }

  let start = 0;
  let end = found.size - 1;
  let code: 200 | 206 | 404 = status;
  const range = status === 200 ? parseRange(c.req.header("range"), found.size) : null;
  if (range === "invalid") {
    c.header("content-range", `bytes */${found.size}`);
    return c.body(null, 416);
  }
  if (range) {
    ({ start, end } = range);
    code = 206;
    c.header("content-range", `bytes ${start}-${end}/${found.size}`);
  }
  c.header("content-length", String(found.size === 0 ? 0 : end - start + 1));

  if (c.req.method === "HEAD" || found.size === 0) return c.body(null, code);
  const stream = createReadStream(found.file, { start, end });
  return c.body(Readable.toWeb(stream) as ReadableStream, code);
}
