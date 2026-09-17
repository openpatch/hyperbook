import { afterAll, beforeAll, expect, test } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import net from "net";
import { WebSocket } from "ws";
import { runDev } from "../dev";

/** See dev.test.ts: assets and locales only exist next to the source after a build. */
async function stageBundledFiles() {
  const pkg = path.join(__dirname, "..");
  const markdownDist = path.join(
    pkg,
    "node_modules",
    "@hyperbook",
    "markdown",
    "dist",
  );
  for (const name of ["assets", "locales"]) {
    const dest = path.join(pkg, name);
    if (await fs.stat(dest).catch(() => null)) continue;
    await fs.cp(path.join(markdownDist, name), dest, { recursive: true });
  }
}

let root: string;
let cwd: string;
let port: number;

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

const indexPath = () => path.join(root, "book", "index.md");

const waitFor = <T>(promise: Promise<T>, what: string, ms = 20_000) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`no ${what} within ${ms}ms`)), ms),
    ),
  ]);

/** The book starts out broken: an unquoted colon in the title. */
beforeAll(async () => {
  await stageBundledFiles();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-dev-error-"));
  await fs.mkdir(path.join(root, "book"), { recursive: true });
  await fs.writeFile(
    path.join(root, "hyperbook.json"),
    JSON.stringify({ name: "Buch", language: "de" }),
  );
  await fs.writeFile(
    indexPath(),
    "---\ntitle: Text als Daten: Tokenisierung\n---\n\nHallo\n",
  );

  cwd = process.cwd();
  process.chdir(root);
  port = await freePort();
  await runDev({ port });
}, 120_000);

afterAll(async () => {
  process.chdir(cwd);
  await fs.rm(root, { recursive: true, force: true });
});

test("keeps listening when the initial build fails", async () => {
  const res = await fetch(`http://localhost:${port}/`);
  expect(res.status).toBe(500);

  const body = await res.text();
  expect(body).toContain("Build failed");
  expect(body).toContain("index.md");
  expect(body).toContain("mapping");
  // The page has to reconnect on its own, or the author reloads by hand.
  expect(body).toContain("/__hyperbook_dev.js");
});

test("still 404s an asset rather than handing it a page", async () => {
  const res = await fetch(`http://localhost:${port}/fehlt.css`);
  expect(res.status).toBe(404);
  expect(await res.text()).not.toContain("Build failed");
});

test("tells a client that connects while the build is broken", async () => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const message = new Promise<any>((resolve) => {
    ws.on("message", (data) => resolve(JSON.parse(data.toString())));
  });

  const msg = await waitFor(message, "rebuild-error");
  expect(msg.type).toBe("rebuild-error");
  expect(msg.message).toContain("index.md");
  ws.close();
}, 30_000);

test("recovers once the file is fixed", async () => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise((resolve) => ws.once("open", resolve));

  const reload = new Promise<any>((resolve) => {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "reload") resolve(msg);
    });
  });

  await fs.writeFile(
    indexPath(),
    '---\ntitle: "Text als Daten: Tokenisierung"\n---\n\nHallo\n',
  );

  const msg = await waitFor(reload, "reload");
  // Every page was missing, not just the saved one.
  expect(msg.changedPages).toBe("*");
  ws.close();

  const res = await fetch(`http://localhost:${port}/`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("Hallo");
}, 60_000);
