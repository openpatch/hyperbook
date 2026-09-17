import chokidar from "chokidar";
import { hyperproject } from "@hyperbook/fs";
import { Hyperproject } from "@hyperbook/types";
import { IncrementalBuilder } from "./incremental";
import path from "path";
import http from "http";
import fs from "fs";
import mime from "mime";
import { WebSocketServer, WebSocket } from "ws";
import { OutgoingHttpHeaders } from "http2";
import chalk from "chalk";
import prompts from "prompts";
import net from "net";
import { reportError } from "./helpers/report-error";

/**
 * Renders a build failure as the plain text shown in the browser overlay.
 * Mirrors what `reportError` prints to the terminal, minus the colour codes.
 */
function formatErrorForBrowser(e: unknown): string {
  const message = e as {
    reason?: string;
    file?: string;
    line?: number | null;
    column?: number | null;
  };

  if (message && typeof message.reason === "string") {
    const where = [message.file, message.line, message.column]
      .filter((part) => part !== undefined && part !== null)
      .join(":");
    return where ? `${where}\n${message.reason}` : message.reason;
  }

  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Whether a missing resource is a page the reader navigated to rather than an
 * asset some page asked for. An image or a bundle wants its 404: a stylesheet
 * that suddenly parses as HTML helps nobody.
 */
function isDocumentRequest(
  request: http.IncomingMessage,
  pathname: string,
): boolean {
  const accept = request.headers.accept || "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) return false;
  const extension = path.extname(pathname);
  return extension === "" || extension === ".html";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * A stand-in page for a route the broken build never produced.
 *
 * It loads the dev client, so it reconnects like any other page and reloads
 * itself as soon as a build succeeds — the author never has to restart the
 * server or remember which URL they were on.
 */
function renderErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Build failed</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 2rem;
        background: #141414;
        color: #f7f7f7;
        font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      h1 { color: #ff6b6b; font-size: 1.1rem; margin: 0 0 1rem; }
      pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
      p { margin-top: 1.5rem; opacity: 0.6; }
    </style>
  </head>
  <body>
    <h1>Build failed</h1>
    <pre>${escapeHtml(message)}</pre>
    <p>Fix the file and save — this page reloads on the next successful build.</p>
    <script src="/__hyperbook_dev.js"></script>
  </body>
</html>
`;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
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
  throw new Error('No free ports available');
}

export async function runDev({ port = 8080 }: { port: number }): Promise<void> {
  // Check if the port is available
  const portAvailable = await isPortAvailable(port);
  
  if (!portAvailable) {
    console.log(chalk.yellow(`Port ${port} is already in use.`));
    
    const response = await prompts({
      type: 'confirm',
      name: 'findFreePort',
      message: 'Would you like to find and use a free port?',
      initial: true
    });
    
    if (!response.findFreePort) {
      console.log(chalk.red('Exiting dev server.'));
      process.exit(0);
    }
    
    try {
      port = await findFreePort(port + 1);
      console.log(chalk.green(`Found free port: ${port}`));
    } catch (error) {
      console.error(chalk.red('Could not find a free port.'));
      process.exit(1);
    }
  }
  const root = process.cwd();
  const rootProject = await hyperproject.get(root);
  const outDir = path.join(rootProject.src, ".hyperbook", "out");

  // The failure the output tree is currently stale because of, or null when
  // the last build succeeded. A broken page used to take the whole dev server
  // down with it, so the author fixed their typo against a dead port; now the
  // server keeps serving and the failure is what it serves.
  let buildError: unknown = null;

  const server = http.createServer(async (request, response) => {
    // Special Case: Reject non-GET methods.
    if (request.method !== "GET") {
      const responseBody = `Forbidden Method: ${request.method}`;

      response.writeHead(403, {
        "Content-Type": "text/plain",
        "Content-Length": Buffer.byteLength(responseBody),
      });

      return response.end(responseBody);
    }

    // Special Case: GET '/client.js'
    if (request.url === "/__hyperbook_dev.js") {
      const responseBody = `
var __hbPort = ${port};
var __hbSocket = null;
var __hbReconnectDelay = 1000;
var __hbConnected = false;

// Same origin as the page, so the dev server is still reachable when the book
// is opened from another device or through a proxy rather than on localhost.
function __hbWsUrl() {
  var protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  return protocol + (window.location.host || "localhost:" + __hbPort);
}

function __hbConnect() {
  __hbSocket = new WebSocket(__hbWsUrl());

  __hbSocket.addEventListener("open", () => {
    __hbConnected = true;
    __hbReconnectDelay = 1000;
    __hbSocket.send(JSON.stringify({ type: "page", href: window.location.pathname }));
    __hbUpdateConnStatus();
  });

  __hbSocket.addEventListener("close", () => {
    __hbConnected = false;
    __hbUpdateConnStatus();
    // Exponential backoff with cap at 10s
    setTimeout(__hbConnect, __hbReconnectDelay);
    __hbReconnectDelay = Math.min(__hbReconnectDelay * 2, 10000);
  });

  __hbSocket.addEventListener("error", () => {
    // The close handler will trigger reconnect
  });

  __hbSocket.addEventListener("message", __hbHandleMessage);
}

// Build errors used to appear only in the terminal, so the browser silently
// kept serving the last good page. Surface them over the content instead.
function __hbShowError(message) {
  var overlay = document.getElementById("__hb_error");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "__hb_error";
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;"
      + "background:rgba(20,20,20,0.94);color:#f7f7f7;padding:2rem;"
      + "font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;"
      + "overflow:auto;white-space:pre-wrap;word-break:break-word;";
    document.body.appendChild(overlay);
  }
  var heading = document.createElement("div");
  heading.textContent = "Build failed";
  heading.style.cssText = "color:#ff6b6b;font-weight:bold;font-size:1.1rem;margin-bottom:1rem;";
  var body = document.createElement("div");
  body.textContent = message;
  var hint = document.createElement("div");
  hint.textContent = "This overlay clears on the next successful build.";
  hint.style.cssText = "margin-top:1.5rem;opacity:0.6;";
  overlay.replaceChildren(heading, body, hint);
}

function __hbHideError() {
  var overlay = document.getElementById("__hb_error");
  if (overlay) overlay.remove();
}

function __hbStopSpinner() {
  var btn = document.getElementById("__hb_reload_btn");
  if (btn) {
    btn.style.animation = "none";
    btn.disabled = false;
    delete btn.dataset.spinning;
    btn.style.opacity = "0.6";
  }
}

function __hbUpdateConnStatus() {
  var dot = document.getElementById("__hb_conn_dot");
  if (dot) {
    dot.style.background = __hbConnected ? "#4ade80" : "#f87171";
  }
}

// Check whether the current page path matches one of the changed pages.
function __hbShouldReload(changedPages) {
  var currentPath = window.location.pathname;
  if (changedPages === "*") return true;
  return changedPages.some(function(p) {
    if (p === "/" && (currentPath === "/" || currentPath === "/index.html")) {
      return true;
    }
    return currentPath === p || currentPath === p + "/" || currentPath === p + ".html"
      || currentPath === p + "/index.html" || currentPath.startsWith(p + "/");
  });
}

// Every <script src> the page has already run. A bundle must not be executed
// twice: customElements.define throws on a name that is already registered.
var __hbLoadedScripts = {};

function __hbIndexLoadedScripts() {
  document.querySelectorAll("script[src]").forEach(function(script) {
    __hbLoadedScripts[script.src] = true;
  });
}

// Not every <script> is code. Directives carry their payloads in ones the
// browser never executes — type="text/plain" for online-ide/sql-ide sources,
// type="application/json" for protect blocks — and the custom element around
// them has already upgraded and read them by the time we get here, so
// replacing those nodes would pull the data out from under it.
var __hbExecutableScriptTypes = [
  "",
  "text/javascript",
  "application/javascript",
  "module",
];

function __hbIsExecutableScript(script) {
  var type = (script.getAttribute("type") || "").toLowerCase();
  return __hbExecutableScriptTypes.indexOf(type) !== -1;
}

// Re-inject scripts that were part of the new <main> content so that
// interactive directives (terminals, canvases, etc.) re-initialise. Scripts
// inserted via innerHTML never run on their own.
function __hbReexecuteScripts(container) {
  container.querySelectorAll("script").forEach(function(oldScript) {
    if (!__hbIsExecutableScript(oldScript)) return;
    if (oldScript.src && __hbLoadedScripts[oldScript.src]) return;
    var newScript = document.createElement("script");
    if (oldScript.src) {
      newScript.src = oldScript.src;
      __hbLoadedScripts[newScript.src] = true;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    // Copy relevant attributes
    if (oldScript.type) newScript.type = oldScript.type;
    if (oldScript.defer) newScript.defer = true;
    if (oldScript.async) newScript.async = true;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

// A directive ships its stylesheet and bundle outside <main> — in <head> or at
// the end of <body> — and its client script initialises either on
// DOMContentLoaded or from a MutationObserver it registers as it loads.
// Neither can be replayed into a page that is already live: appending the
// script after the content is in the DOM leaves the directive silently inert.
// So a page that wants an asset this one does not have needs a real reload.
// Directives render an element classed directive-<name>, and their client
// scripts bind to DOMContentLoaded or to observers that only look at the nodes
// directly inserted — not at descendants, which is all an innerHTML swap
// produces. So a mermaid diagram swapped back in arrives as raw source that
// nothing re-renders. Plain prose has no such contract, and is the case the
// swap is actually for.
function __hbHasDirectives(rootEl) {
  var classed = rootEl.querySelectorAll("[class]");
  for (var i = 0; i < classed.length; i++) {
    var tokens = classed[i].classList;
    for (var j = 0; j < tokens.length; j++) {
      if (tokens[j].indexOf("directive-") === 0) return true;
    }
  }
  return false;
}

function __hbNeedsNewAssets(doc) {
  var selector = "link[rel~='stylesheet'][href], script[src]";
  var have = {};
  document.querySelectorAll(selector).forEach(function(el) {
    have[el.href || el.src] = true;
  });
  return [].some.call(doc.querySelectorAll(selector), function(el) {
    // Anything inside <main> arrives with the content swap itself.
    if (el.closest("main")) return false;
    var url = el.href || el.src;
    return !!url && !have[url];
  });
}

// Fetch the updated page and swap <main> content in-place.
// Preserves scroll position, avoids full-page reload flash, and keeps
// any client-side state outside <main> (e.g. the dev toolbar itself).
function __hbSwapMain() {
  fetch(window.location.href, { cache: "no-store" })
    .then(function(res) { return res.text(); })
    .then(function(html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var newMain = doc.querySelector("main");
      var oldMain = document.querySelector("main");
      if (
        !newMain ||
        !oldMain ||
        __hbNeedsNewAssets(doc) ||
        __hbHasDirectives(newMain) ||
        __hbHasDirectives(oldMain)
      ) {
        // Structure changed, the page picked up a directive whose assets this
        // one never loaded, or either side has a directive that would not
        // survive the swap.
        window.location.reload();
        return;
      }
      // Preserve scroll position across the swap
      var scrollTop = oldMain.scrollTop;
      if (doc.title) document.title = doc.title;
      oldMain.innerHTML = newMain.innerHTML;
      oldMain.scrollTop = scrollTop;
      __hbReexecuteScripts(oldMain);
    })
    .catch(function() {
      // Network error — full reload
      window.location.reload();
    });
}

function __hbHandleMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    if (event.data === "RELOAD") {
      msg = { type: "reload", changedPages: "*" };
    } else {
      return;
    }
  }

  if (msg.type === "rebuilding") {
    __hbHideError();
    var btn = document.getElementById("__hb_reload_btn");
    if (btn) {
      btn.style.opacity = "1";
      btn.style.animation = "__hb_spin 0.8s linear infinite";
      btn.disabled = true;
      btn.dataset.spinning = "1";
    }
  }

  if (msg.type === "rebuild-error") {
    __hbStopSpinner();
    __hbShowError(msg.message);
  }

  if (msg.type === "rebuild-complete") {
    var btn = document.getElementById("__hb_reload_btn");
    if (btn) {
      btn.style.animation = "none";
      btn.disabled = false;
      delete btn.dataset.spinning;
      btn.innerHTML = "&#x2713;";
      setTimeout(function() { btn.innerHTML = "&#x21bb;"; btn.style.opacity = "0.6"; }, 2000);
    }
  }

  if (msg.type === "reload") {
    // The page survives a <main> swap, so nothing else would ever re-enable
    // the button — and clients whose page is not in changedPages never even
    // get that far.
    __hbStopSpinner();
    if (__hbShouldReload(msg.changedPages)) {
      // For full structural changes, do a full page reload to pick up
      // sidebar/navigation changes. For single-page changes, swap only
      // <main> content to preserve state and avoid flash.
      if (msg.changedPages === "*") {
        window.location.reload();
      } else {
        __hbSwapMain();
      }
    }
  }
}

window.addEventListener("DOMContentLoaded", function() {
  // Inject keyframes for spinner
  var style = document.createElement("style");
  style.textContent = "@keyframes __hb_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(style);

  // Connection status dot
  var dot = document.createElement("div");
  dot.id = "__hb_conn_dot";
  dot.style.cssText = "position:fixed;bottom:18px;right:62px;z-index:99999;"
    + "width:10px;height:10px;border-radius:50%;background:#f87171;"
    + "transition:background 0.3s;";
  document.body.appendChild(dot);

  // Force full rebuild button
  var btn = document.createElement("button");
  btn.id = "__hb_reload_btn";
  btn.type = "button";
  btn.innerHTML = "&#x21bb;";
  btn.title = "Force full rebuild";
  btn.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:99999;"
    + "width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;"
    + "background:#333;color:#fff;font-size:20px;line-height:1;"
    + "box-shadow:0 2px 8px rgba(0,0,0,0.3);opacity:0.6;transition:opacity 0.2s;";
  btn.addEventListener("mouseenter", function() { btn.style.opacity = "1"; });
  btn.addEventListener("mouseleave", function() { if (!btn.dataset.spinning) btn.style.opacity = "0.6"; });
  btn.addEventListener("click", function() {
    if (__hbSocket && __hbSocket.readyState === WebSocket.OPEN) {
      btn.style.opacity = "1";
      btn.style.animation = "__hb_spin 0.8s linear infinite";
      btn.disabled = true;
      btn.dataset.spinning = "1";
      __hbSocket.send(JSON.stringify({ type: "force-reload" }));
    }
  });
  document.body.appendChild(btn);

  __hbIndexLoadedScripts();

  // Connect WebSocket
  __hbConnect();
});
`;

      response.writeHead(200, {
        "Content-Length": Buffer.byteLength(responseBody),
        "Content-Type": "application/javascript",
      });

      return response.end(responseBody);
    }

    // General Case: GET request for any resource

    // Parse the request URL to get the resource pathname.
    if (!request.url) return;

    const url = new URL(request.url, `http://${request.headers.host}`);
    let pathname = url.pathname;
    const basePath = rootProject.basePath || "";

    if (pathname.startsWith("/")) {
      pathname = pathname.slice(basePath.length + 1);
    } else {
      pathname = pathname.slice(basePath.length);
    }

    // If the pathname ends with '/', append 'index.html'.
    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    try {
      // Try to read the given resource into a Buffer.
      pathname = decodeURIComponent(pathname);
      let resourcePath = path.join(outDir, pathname);
      let responseBody: Buffer;
      responseBody = await fs.promises
        .readFile(resourcePath)
        .catch(async () => {
          resourcePath = path.join(outDir, pathname + ".html");
          return await fs.promises.readFile(resourcePath);
        })
        .catch(async () => {
          resourcePath = path.join(outDir, pathname, "index.html");
          return await fs.promises.readFile(resourcePath);
        });

      // HTML Files: Inject a <script> tag before </body>
      if (resourcePath.endsWith(".html")) {
        responseBody = Buffer.from(
          responseBody
            .toString()
            .replace(
              /(<\/body>)(?![\s\S]*\1)/,
              '<script src="/__hyperbook_dev.js"></script></body>',
            ),
        );
      }

      response.writeHead(200, {
        "Content-Type": mime.getType(resourcePath),
        "Content-Length": Buffer.byteLength(responseBody),
      } as OutgoingHttpHeaders);

      return response.end(responseBody);
    } catch (e) {
      // A build that never finished leaves most of the tree missing, so a 404
      // here says nothing useful. Hand back the reason instead — the page
      // reconnects and reloads itself once a build succeeds.
      if (buildError !== null && isDocumentRequest(request, pathname)) {
        const responseBody = renderErrorPage(formatErrorForBrowser(buildError));

        response.writeHead(500, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(responseBody),
        });

        return response.end(responseBody);
      }

      // Respond to all errors with a 404 response.
      const responseBody = `Cannot GET resource: ${pathname}`;

      response.writeHead(404, {
        "Content-Type": "text/plain",
        "Content-Length": Buffer.byteLength(responseBody),
      });

      return response.end(responseBody);
    }
  });

  ////////////////////
  // WebSocket Server
  ////////////////////

  const reloadServer = new WebSocketServer({
    server,
  });

  const broadcast = (msg: object) => {
    const message = JSON.stringify(msg);
    reloadServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  const sendReload = (changedPages: string[] | "*") => {
    broadcast({ type: "reload", changedPages });
  };

  // Handle client messages (force-reload requests)
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
          rebuilding = true;
          broadcast({ type: "rebuilding" });
          builder.handleChange("hyperbook.json", "change")
            .then(() => {
              const recovered = buildError !== null;
              buildError = null;
              broadcast({ type: "rebuild-complete" });
              // Pages that were standing in for a failed build have nothing
              // else to tell them the book is whole again.
              if (recovered) sendReload("*");
            })
            .catch((e) => {
              buildError = e;
              reportError(e);
              broadcast({
                type: "rebuild-error",
                message: formatErrorForBrowser(e),
              });
            })
            .finally(() => {
              rebuilding = false;
              // Process any changes that accumulated during the forced rebuild
              if (pendingFiles.size > 0) {
                flushPendingChanges();
              }
            });
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  ////////////////////
  // Incremental Builder
  ////////////////////

  const builder = new IncrementalBuilder(root, rootProject);

  let rebuilding = false;
  let pendingTimeout: NodeJS.Timeout | null = null;
  const pendingFiles = new Map<string, "add" | "change" | "unlink">();

  const DEBOUNCE_MS = 100;

  // Process all accumulated file changes as a single batch.
  // Each file is fed to builder.handleChange. Results are aggregated:
  // if any change returns "*", the final reload covers all pages.
  // Otherwise, all individual page lists are merged.
  async function flushPendingChanges() {
    if (rebuilding || pendingFiles.size === 0) return;
    rebuilding = true;
    broadcast({ type: "rebuilding" });

    const files = [...pendingFiles.entries()];
    pendingFiles.clear();

    const start = performance.now();
    let allChangedPages: string[] | "*" = [];
    let hasError = false;

    for (let i = 0; i < files.length; i++) {
      const [file, eventType] = files[i];
      console.log(`${chalk.yellow(`[File ${eventType}]`)}: ${file}`);
      try {
        const result = await builder.handleChange(file, eventType);
        // Aggregate: once "*" always "*"; otherwise merge page lists
        if (allChangedPages !== "*") {
          if (result.changedPages === "*") {
            allChangedPages = "*";
          } else {
            allChangedPages = [...new Set([...allChangedPages, ...result.changedPages])];
          }
        }
      } catch (e) {
        buildError = e;
        reportError(e);
        broadcast({
          type: "rebuild-error",
          message: formatErrorForBrowser(e),
        });
        hasError = true;
        // The batch is already drained, so anything the failed file kept us
        // from reaching would be lost — and stay stale until touched again.
        for (const [queuedFile, queuedEvent] of files.slice(i + 1)) {
          if (!pendingFiles.has(queuedFile)) {
            pendingFiles.set(queuedFile, queuedEvent);
          }
        }
        break;
      }
    }

    const elapsed = (performance.now() - start).toFixed(0);

    if (!hasError) {
      if (allChangedPages === "*" || allChangedPages.length > 0) {
        console.log(`${chalk.green("[Incremental]")} Rebuilt in ${elapsed}ms`);
      }
      // Whatever the batch touched, a build that had been failing leaves every
      // page stale — including the error pages standing in for routes that
      // were never written.
      const recovered = buildError !== null;
      buildError = null;
      sendReload(recovered ? "*" : allChangedPages);
    }

    rebuilding = false;

    // If more changes arrived during the rebuild, schedule another flush
    if (pendingFiles.size > 0) {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(flushPendingChanges, DEBOUNCE_MS);
    }
  }

  const handleFileChange =
    (eventType: "add" | "change" | "unlink") => (file: string) => {
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

  // A book with one broken page used to end the process here, before the
  // server ever listened. Keep going: the failure is reported to the terminal,
  // served to the browser, and cleared by the save that fixes it.
  try {
    await builder.initialize();
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
