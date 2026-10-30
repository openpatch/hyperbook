import { mkdtempSync } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/server/app";
import { hashPassword } from "../src/server/auth/password";
import { loadConfig } from "../src/server/config";
import { migrateDb, openDb } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import type { Deps } from "../src/server/deps";
import { BuildQueue } from "../src/server/hosting/builds";
import { type RenderSpawner, Renderers } from "../src/server/hosting/renders";
import type { Runner } from "../src/server/hosting/runner";
import { createMemoryDns } from "../src/server/dns";
import { createMemoryMailer } from "../src/server/mail";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export const ADMIN_HOST = "admin.test";
export const ADMIN_ORIGIN = "http://admin.test";

/** Data directories of this test file's instances; removed by tests/setup.ts. */
export const dataDirs: string[] = [];

/**
 * Stands in for `hyperbook build` in tests: the "built" book is a copy of its
 * source, so tests can check what gets served without running the real CLI.
 */
export const copyRunner: Runner = async ({ jobDir, srcDir }) => {
  const outDir = path.join(jobDir, "out");
  await cp(srcDir, outDir, { recursive: true });
  return { ok: true, outDir, sizeBytes: 1 };
};

/**
 * Stands in for `hyperbook render` in tests: a page "renders" to its source
 * text, at the address Hyperbook would give it.
 */
export const textRender: RenderSpawner = async ({ srcDir }) => {
  const pages = async () => {
    const out: { file: string; href: string }[] = [];
    for (const folder of ["book", "glossary"]) {
      const entries = await readdir(path.join(srcDir, folder), { recursive: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const file = `${folder}/${entry}`;
        const href = (folder === "book" ? "" : "/glossary") + ("/" + entry.slice(0, -3)).replace(/\/index$/, "");
        out.push({ file, href: href || "/" });
      }
    }
    return out;
  };
  return {
    async render(target) {
      const page = (await pages()).find((p) => ("file" in target ? p.file === target.file : p.href === target.href));
      if (!page) return { ok: false, error: "There is no page here", log: "" };
      const out = page.href === "/" ? "index.html" : `${page.href.slice(1)}.html`;
      await mkdir(path.dirname(path.join(srcDir, ".hyperbook/out", out)), { recursive: true });
      await writeFile(path.join(srcDir, ".hyperbook/out", out), await readFile(path.join(srcDir, page.file)));
      return { ok: true, href: page.href, file: page.file, out, log: "" };
    },
    close() {},
  };
};

/**
 * A fresh instance: in-memory database with migrations applied, and an empty
 * data directory for book repositories and builds.
 */
export function setup(env: Record<string, string> = {}, options: { runner?: Runner } = {}) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "cloud-test-"));
  dataDirs.push(dataDir);
  const config = loadConfig({ NODE_ENV: "test", DATA_DIR: dataDir, ...env });
  const { db, sqlite } = openDb(":memory:");
  migrateDb(sqlite, db, { migrationsFolder, file: ":memory:" });
  const mailer = createMemoryMailer();
  const builds = new BuildQueue(db, config, options.runner ?? copyRunner);
  builds.start();
  const dns = createMemoryDns();
  const renders = new Renderers(config, textRender);
  const deps: Deps = { config, db, mailer, builds, renders, dns };
  const app = createApp(deps);
  return { config, db, sqlite, mailer, builds, renders, dns, deps, app };
}

export type Instance = ReturnType<typeof setup>;

export async function createUser(
  { db }: Instance,
  values: {
    email: string;
    password?: string;
    role?: "admin" | "teacher";
    displayName?: string;
  },
) {
  return db
    .insert(users)
    .values({
      email: values.email,
      passwordHash: await hashPassword(values.password ?? "correct horse battery"),
      role: values.role ?? "teacher",
      displayName: values.displayName ?? "",
      emailVerifiedAt: new Date(),
      approvedAt: new Date(),
    })
    .returning()
    .get();
}

/**
 * A browser-like client for the admin API: same-origin requests with JSON
 * bodies, and it keeps the session cookie between requests.
 */
export function client({ app }: Instance) {
  let cookie = "";

  async function request(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { host: ADMIN_HOST, ...extraHeaders };
    if (method !== "GET") headers.origin = ADMIN_ORIGIN;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const pair = setCookie.split(";")[0]!;
      cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  /** Sends `files` as a zip in a multipart form, like the upload field. */
  async function upload(path: string, zip: Uint8Array, name = "book.zip") {
    const form = new FormData();
    form.append("file", new File([zip as BlobPart], name, { type: "application/zip" }));
    const headers: Record<string, string> = { host: ADMIN_HOST, origin: ADMIN_ORIGIN };
    if (cookie) headers.cookie = cookie;
    const res = await app.request(path, { method: "POST", headers, body: form });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  return {
    get: (path: string) => request("GET", path),
    upload,
    post: (path: string, body?: unknown) => request("POST", path, body ?? {}),
    put: (path: string, body?: unknown) => request("PUT", path, body ?? {}),
    patch: (path: string, body?: unknown) => request("PATCH", path, body ?? {}),
    delete: (path: string) => request("DELETE", path),
    raw: request,
    get cookie() {
      return cookie;
    },
  };
}

export type Client = ReturnType<typeof client>;

export async function loggedIn(
  instance: Instance,
  values: Parameters<typeof createUser>[1],
) {
  const user = await createUser(instance, values);
  const c = client(instance);
  const res = await c.post("/api/auth/login", {
    email: values.email,
    password: values.password ?? "correct horse battery",
  });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return { user, c };
}
