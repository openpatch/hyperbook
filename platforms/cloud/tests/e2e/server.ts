import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import { installBlockflowV020 } from "./blockflow-runtime";

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
  // The blockflow v0.2.0 runtime (embed entries) for the visual-editor tests,
  // in case the read-only CLI cache still holds the older bundle.
  await installBlockflowV020(dataDir);
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

/** Forces navigator.onLine to true before any page script runs. System
 *  Chromium in environments without a network notifier (containers) reports
 *  offline, which would park the student app's store sync in its offline
 *  queue. Passed as a string: a function would be transpiled by Playwright
 *  and break on the injected __name helper. */
const FORCE_ONLINE =
  "Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => true });";

/** System Chromium (CHROMIUM_PATH, or /usr/bin/chromium). The browser runs
 *  with an English locale, so the UI under test renders in English no matter
 *  what language the host system is set to (the app follows the browser's
 *  Accept-Language / navigator.languages). */
export async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    env: { ...process.env, LANG: "en_US.UTF-8", LANGUAGE: "en_US:en", LC_ALL: "en_US.UTF-8" },
  });
  // Patch newPage/newContext, so every page in every test gets the script.
  const newPage = browser.newPage.bind(browser);
  browser.newPage = (async (options?: Parameters<Browser["newPage"]>[0]) => {
    const page = await newPage(options);
    await page.addInitScript(FORCE_ONLINE);
    return page;
  }) as typeof browser.newPage;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = (async (options?: Parameters<Browser["newContext"]>[0]) => {
    const context = await newContext(options);
    await context.addInitScript(FORCE_ONLINE);
    return context;
  }) as typeof browser.newContext;
  return browser;
}
