import { afterAll, beforeAll, expect, test } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import net from "net";
import { WebSocket } from "ws";
import { runDev } from "../dev";

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

/** A hyperlibrary keeps its books in subdirectories of the root. */
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-dev-"));
  await fs.writeFile(
    path.join(root, "hyperlibrary.json"),
    JSON.stringify({
      name: "Lib",
      library: [{ src: "de", name: "Deutsch", basePath: "de" }],
    }),
  );
  await fs.mkdir(path.join(root, "de", "book"), { recursive: true });
  await fs.writeFile(
    path.join(root, "de", "hyperbook.json"),
    JSON.stringify({ name: "Buch", language: "de" }),
  );
  await fs.writeFile(
    path.join(root, "de", "book", "index.md"),
    "---\nname: Start\n---\n\nHallo\n",
  );

  cwd = process.cwd();
  process.chdir(root);
  port = await freePort();
  // runDev resolves once the watcher is live, so no settle delay is needed.
  await runDev({ port });
}, 120_000);

afterAll(async () => {
  process.chdir(cwd);
  await fs.rm(root, { recursive: true, force: true });
});

test("serves the dev client untruncated", async () => {
  const res = await fetch(`http://localhost:${port}/__hyperbook_dev.js`);
  const body = await res.text();
  // Content-Length counts bytes, so the non-ASCII comments must not clip it.
  expect(Number(res.headers.get("content-length"))).toBe(
    Buffer.byteLength(body),
  );
  expect(body.trimEnd().endsWith("});")).toBe(true);
});

test("reloads when a page inside a library sub-book changes", async () => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise((resolve) => ws.once("open", resolve));

  // A failed rebuild answers with rebuild-error and no reload, so report that
  // message rather than letting the race below time out with nothing to go on.
  const reload = new Promise<any>((resolve, reject) => {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "reload") resolve(msg);
      if (msg.type === "rebuild-error") {
        reject(new Error(`rebuild failed: ${msg.message}`));
      }
    });
  });

  await fs.writeFile(
    path.join(root, "de", "book", "index.md"),
    "---\nname: Start\n---\n\nHallo Welt\n",
  );

  const msg = await Promise.race([
    reload,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("no reload within 20s")), 20_000),
    ),
  ]);
  expect(msg).toBeTruthy();
  ws.close();
}, 30_000);

test("ignores files that cannot affect the build", async () => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise((resolve) => ws.once("open", resolve));

  let sawReload = false;
  ws.on("message", (data) => {
    if (JSON.parse(data.toString()).type === "reload") sawReload = true;
  });

  await fs.writeFile(path.join(root, "README.md"), "# noise\n");
  await new Promise((r) => setTimeout(r, 3000));
  expect(sawReload).toBe(false);
  ws.close();
}, 20_000);
