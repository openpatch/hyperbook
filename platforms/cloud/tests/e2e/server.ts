import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";

const root = fileURLToPath(new URL("../..", import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export const ADMIN = { email: "admin@example.org", password: "admin password 123" };

/** Starts the built server (pnpm build first) on a free port with an empty data dir. */
export async function startServer(extraEnv: Record<string, string> = {}) {
  const entry = path.join(root, "dist/server/main.js");
  if (!existsSync(entry)) throw new Error("Run `pnpm build` before the e2e tests");
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  // The server extracts the element runtimes (about 1 GB) into its data dir,
  // so a suite's data dir is removed when its server stops — and when it
  // never came up — to keep the temporary volume from filling up.
  const dataDir = mkdtempSync(path.join(tmpdir(), "hyperbook-cloud-e2e-"));
  const removeDataDir = () => rmSync(dataDir, { recursive: true, force: true });
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      PORT: String(port),
      ADMIN_ORIGIN: origin,
      BOOKS_DOMAIN: `books.localhost:${port}`,
      CREDENTIALS_KEY: Buffer.alloc(32, 3).toString("base64"),
      DATA_DIR: dataDir,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  for (let i = 0; ; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (i > 100 || child.exitCode !== null) {
      removeDataDir();
      throw new Error(`Server did not start:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    origin,
    port,
    output: () => output,
    /** Stops the server and removes its data dir; await it, so the test
     * worker does not exit before the dir is gone. */
    stop: async () => {
      child.kill("SIGTERM");
      // After the server has flushed and exited; after five seconds at the
      // latest, so a wedged process does not keep its data dir either.
      await new Promise<void>((resolve) => {
        child.once("exit", resolve);
        const timer = setTimeout(resolve, 5_000);
        timer.unref?.();
      });
      removeDataDir();
    },
  };
}

/** System Chromium (CHROMIUM_PATH, or /usr/bin/chromium). */
export function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  });
}
