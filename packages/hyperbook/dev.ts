import chokidar from "chokidar";
import { hyperproject } from "@hyperbook/fs";
import { Hyperproject } from "@hyperbook/types";
import { AssetManager } from "./helpers/assets";
import path from "path";
import http from "http";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import chalk from "chalk";
import prompts from "prompts";
import net from "net";
import { reportError } from "./helpers/report-error";
import { devClient } from "./dev-client";
import {
  formatErrorForBrowser,
  isDocumentRequest,
  renderErrorPage,
} from "./dev-error";
import { BookBackend } from "./dev-book";
import { DevBackend, FileEvent, LibraryBackend } from "./dev-library";

const CLIENT_PATH = "/__hyperbook_dev.js";

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findFreePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port < 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error("No free ports available");
}

/**
 * `hyperbook dev`: serves the project and reloads the open pages when its
 * files change. A book renders page by page as pages are visited (see
 * dev-book.ts), so the server is up at once whatever the size of the book; a
 * library is built in full and kept up to date (see dev-library.ts).
 */
export async function runDev({
  port = 8080,
  offline = false,
}: {
  port: number;
  offline?: boolean;
}): Promise<void> {
  // Check if the port is available
  const portAvailable = await isPortAvailable(port);

  if (!portAvailable) {
    console.log(chalk.yellow(`Port ${port} is already in use.`));

    const response = await prompts({
      type: "confirm",
      name: "findFreePort",
      message: "Would you like to find and use a free port?",
      initial: true,
    });

    if (!response.findFreePort) {
      console.log(chalk.red("Exiting dev server."));
      process.exit(0);
    }

    try {
      port = await findFreePort(port + 1);
      console.log(chalk.green(`Found free port: ${port}`));
    } catch (error) {
      console.error(chalk.red("Could not find a free port."));
      process.exit(1);
    }
  }
  const root = process.cwd();
  const rootProject = await hyperproject.get(root);
  const assets = new AssetManager({ offline });

  let backend: DevBackend;
  if (rootProject.type === "book") {
    backend = new BookBackend(root, rootProject, assets);
  } else {
    // Persist the vfile directory caches on disk (vdirectory.*.json,
    // vfiles.json) so a restarted dev server does not re-walk and re-read the
    // whole library. vfile.clean removes them on every change, and the
    // watcher below ignores them. An explicit HYPERBOOK_CACHE in the
    // environment wins, and an empty value opts out.
    if (process.env.HYPERBOOK_CACHE === undefined) {
      process.env.HYPERBOOK_CACHE = "1";
    }
    backend = new LibraryBackend(root, rootProject, assets);
  }

  const client = devClient(port);
  const clientTag = `<script src="${CLIENT_PATH}"></script>`;

  // The failure the whole output is stale because of, or null. Only a
  // library's build fails as a whole; a book's pages fail one by one, each
  // on its own page.
  let buildError: unknown = null;

  const send = (
    response: http.ServerResponse,
    status: number,
    type: string,
    body: string | Buffer,
  ) => {
    response.writeHead(status, {
      "Content-Type": type,
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
    });
    response.end(body);
  };

  const server = http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return send(response, 403, "text/plain", `Forbidden Method: ${request.method}`);
    }

    if (request.url === CLIENT_PATH) {
      return send(response, 200, "application/javascript", client);
    }

    if (!request.url) return;

    const url = new URL(request.url, `http://${request.headers.host}`);
    let pathname = url.pathname;
    const basePath = rootProject.basePath || "";

    if (pathname.startsWith("/")) {
      pathname = pathname.slice(basePath.length + 1);
    } else {
      pathname = pathname.slice(basePath.length);
    }

    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      return send(response, 400, "text/plain", "Bad path");
    }

    let served;
    try {
      served = await backend.serve(pathname);
    } catch (e) {
      reportError(e);
      return send(response, 500, "text/plain; charset=utf-8", formatErrorForBrowser(e));
    }

    if (!served) {
      // A build that never finished leaves most of the tree missing, so a 404
      // here says nothing useful. Hand back the reason instead — the page
      // reconnects and reloads itself once a build succeeds.
      if (buildError !== null && isDocumentRequest(request, pathname)) {
        const body = renderErrorPage("Build failed", formatErrorForBrowser(buildError));
        return send(
          response,
          500,
          "text/html; charset=utf-8",
          body.replace("</body>", `${clientTag}</body>`),
        );
      }
      return send(response, 404, "text/plain", `Cannot GET resource: ${pathname}`);
    }

    if ("file" in served) {
      if (!served.type.startsWith("text/html")) {
        const stat = await fs.promises.stat(served.file).catch(() => null);
        if (!stat) return send(response, 404, "text/plain", `Cannot GET resource: ${pathname}`);
        response.writeHead(served.status, {
          "Content-Type": served.type,
          "Content-Length": stat.size,
          "Cache-Control": "no-store",
        });
        if (request.method === "HEAD") return response.end();
        return fs.createReadStream(served.file).pipe(response);
      }
      served = {
        status: served.status,
        type: served.type,
        body: await fs.promises.readFile(served.file),
      };
    }

    let body = served.body;
    if (served.type.startsWith("text/html")) {
      body = body
        .toString()
        .replace(/(<\/body>)(?![\s\S]*\1)/, `${clientTag}</body>`);
    }
    return send(response, served.status, served.type, body);
  });

  ////////////////////
  // WebSocket Server
  ////////////////////

  const reloadServer = new WebSocketServer({ server });

  const broadcast = (msg: object) => {
    const message = JSON.stringify(msg);
    reloadServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  let rebuilding = false;
  let pendingTimeout: NodeJS.Timeout | null = null;
  const pendingFiles = new Map<string, FileEvent>();

  const DEBOUNCE_MS = 100;

  /** Runs a change of the output and tells the pages how it went. */
  async function update(
    run: () => Promise<string[] | "*">,
    label: string,
  ): Promise<void> {
    rebuilding = true;
    broadcast({ type: "rebuilding" });
    const start = performance.now();
    try {
      const changed = await run();
      // A build that had been failing leaves every page stale — including
      // the error pages standing in for routes that were never written.
      const recovered = buildError !== null;
      buildError = null;
      if (rootProject.type !== "book") {
        console.log(
          `${chalk.green(`[${label}]`)} Done in ${(performance.now() - start).toFixed(0)}ms`,
        );
      }
      broadcast({ type: "rebuild-complete" });
      broadcast({ type: "reload", changedPages: recovered ? "*" : changed });
    } catch (e) {
      buildError = e;
      reportError(e);
      broadcast({ type: "rebuild-error", message: formatErrorForBrowser(e) });
    } finally {
      rebuilding = false;
      // More changes may have arrived meanwhile.
      if (pendingFiles.size > 0) {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(flushPendingChanges, DEBOUNCE_MS);
      }
    }
  }

  async function flushPendingChanges() {
    if (rebuilding || pendingFiles.size === 0) return;
    const files = [...pendingFiles.entries()];
    pendingFiles.clear();
    for (const [file, eventType] of files) {
      console.log(`${chalk.yellow(`[File ${eventType}]`)}: ${file}`);
    }
    await update(() => backend.change(files), "Incremental");
  }

  reloadServer.on("connection", (ws) => {
    // A page opened while the build is broken would otherwise look fine: the
    // overlay only ever arrived with a rebuild it was not around for.
    if (buildError !== null) {
      ws.send(
        JSON.stringify({
          type: "rebuild-error",
          message: formatErrorForBrowser(buildError),
        }),
      );
    }

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "force-reload" && !rebuilding) {
          console.log(`${chalk.yellow("[Force Reload]")} Triggered by client`);
          void update(async () => {
            await backend.rebuild();
            return "*";
          }, "Force Reload");
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  const handleFileChange = (eventType: FileEvent) => (file: string) => {
    // Coalesce: one file can fire several events inside a debounce window.
    // add/unlink outrank change, and a later add/unlink replaces an earlier
    // one — editors that save atomically emit unlink followed by add.
    const existing = pendingFiles.get(file);
    if (!existing || existing === "change" || eventType !== "change") {
      pendingFiles.set(file, eventType);
    }

    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(flushPendingChanges, DEBOUNCE_MS);
  };

  // A project with one broken page used to end the process here, before the
  // server ever listened. Keep going: the failure is reported to the
  // terminal, served to the browser, and cleared by the save that fixes it.
  try {
    await backend.start();
  } catch (e) {
    buildError = e;
    reportError(e);
    console.log(
      `${chalk.yellow("[DEV-SERVER]")} Initial build failed. Serving the error until it is fixed.`,
    );
  }

  // Resolve only once the socket is actually accepting, or a caller that
  // awaits runDev can still race the first request.
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(
        `${chalk.yellow("[DEV-SERVER]")} is running at http://localhost:${port}`,
      );
      resolve();
    });
  });

  ////////////////////
  // File Watching
  ////////////////////

  const outDir = path.join(rootProject.src, ".hyperbook", "out");

  // Only the entries below can affect a build. Everything else in a project
  // (README, LICENSE, editor configs) used to trigger a structural rebuild.
  const WATCHED_ENTRIES = [
    "archives",
    "book",
    "glossary",
    "public",
    "book-public",
    "glossary-public",
    "snippets",
    "templates",
    "hyperbook.json",
    "hyperlibrary.json",
  ];

  // A library keeps its books in subdirectories, so each sub-project brings
  // its own set of watched entries. Watching only the root's would leave a
  // hyperlibrary with nothing to reload on.
  const collectProjectRoots = (
    project: Hyperproject,
    acc: string[] = [],
  ): string[] => {
    acc.push(path.resolve(project.src));
    if (project.type === "library") {
      for (const child of project.projects) {
        collectProjectRoots(child, acc);
      }
    }
    return acc;
  };

  const projectRoots = collectProjectRoots(rootProject);

  const isInside = (parent: string, child: string) =>
    child === parent || child.startsWith(parent + path.sep);

  // Decided per path rather than pinned to a list at startup, so a snippets/
  // folder created mid-session is picked up too.
  const isWatched = (absolute: string): boolean =>
    projectRoots.some((projectRoot) => {
      if (absolute === projectRoot) return true;
      // Ancestors of a sub-project have to stay traversable, or chokidar never
      // descends far enough to reach the book inside them.
      if (isInside(absolute, projectRoot)) return true;
      if (!isInside(projectRoot, absolute)) return false;
      const [entry] = path.relative(projectRoot, absolute).split(path.sep);
      return WATCHED_ENTRIES.includes(entry);
    });

  // chokidar dropped glob support in v4, so these have to be matched by hand.
  const isIgnored = (absolute: string): boolean => {
    if (isInside(outDir, absolute)) return true;
    const segments = path.relative(root, absolute).split(path.sep);
    if (segments.some((segment) => segment.startsWith("."))) return true;
    if (segments.includes("node_modules")) return true;
    // A zip directly under archives/ is the build's own output, not a source.
    // Elsewhere — public/, say — a zip is a perfectly good downloadable.
    return projectRoots.some(
      (projectRoot) =>
        path.dirname(absolute) === path.join(projectRoot, "archives") &&
        absolute.endsWith(".zip"),
    );
  };

  // Use native fs events by default for instant detection. Polling is only
  // needed on network filesystems (Docker volumes, WSL2, NFS) where inotify
  // / FSEvents don't fire. Enable with HYPERBOOK_POLLING=1.
  const usePolling = process.env.HYPERBOOK_POLLING === "1";

  const watcher = chokidar
    .watch(root, {
      ignoreInitial: true,
      cwd: root,
      usePolling,
      interval: usePolling ? 300 : undefined,
      ignored: (absolute) => {
        const resolved = path.resolve(root, absolute);
        return isIgnored(resolved) || !isWatched(resolved);
      },
    })
    .on("add", handleFileChange("add"))
    .on("change", handleFileChange("change"))
    .on("unlink", handleFileChange("unlink"));

  await new Promise<void>((resolve) => watcher.once("ready", () => resolve()));
}
