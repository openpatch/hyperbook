import chokidar from "chokidar";
import { hyperproject } from "@hyperbook/fs";
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
const socket = new WebSocket("ws://localhost:${port}");

// Report current page to server
socket.addEventListener("open", () => {
  socket.send(JSON.stringify({ type: "page", href: window.location.pathname }));
});

socket.addEventListener("message", (event) => {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    // Legacy fallback
    if (event.data === "RELOAD") {
      msg = { type: "reload", changedPages: "*" };
    } else {
      return;
    }
  }

  if (msg.type === "rebuilding") {
    var btn = document.getElementById("__hb_reload_btn");
    if (btn) {
      btn.style.opacity = "1";
      btn.style.animation = "__hb_spin 0.8s linear infinite";
      btn.disabled = true;
      btn.dataset.spinning = "1";
    }
  }

  if (msg.type === "rebuild-complete") {
    // Force-reload build finished — stop spinner, don't refresh
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
    const currentPath = window.location.pathname;
    const shouldReload = msg.changedPages === "*" || msg.changedPages.some(function(p) {
      // Special case for root page
      if (p === "/" && (currentPath === "/" || currentPath === "/index.html")) {
        return true;
      }
      return currentPath === p || currentPath === p + "/" || currentPath === p + ".html"
        || currentPath === p + "/index.html" || currentPath.startsWith(p + "/");
    });

    if (shouldReload) {
      const main = document.querySelector("main");
      if (main) {
        localStorage.setItem("__hyperbook_dev_scroll", main.scrollTop);
      }
      window.location.reload();
    }
  }
});

window.onload = () => {
  const main = document.querySelector("main");
  const scrollTop = localStorage.getItem("__hyperbook_dev_scroll");
  if (main && scrollTop !== null) {
    main.scrollTop = parseInt(scrollTop, 10);
    localStorage.removeItem("__hyperbook_dev_scroll");
  }

  // Force full reload button
  var style = document.createElement("style");
  style.textContent = "@keyframes __hb_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(style);

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
    btn.style.opacity = "1";
    btn.style.animation = "__hb_spin 0.8s linear infinite";
    btn.disabled = true;
    btn.dataset.spinning = "1";
    socket.send(JSON.stringify({ type: "force-reload" }));
  });
  document.body.appendChild(btn);
};
`;

      response.writeHead(200, {
        "Content-Length": responseBody.length,
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
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "force-reload" && !rebuilding) {
          console.log(`${chalk.yellow("[Force Reload]")} Triggered by client`);
          rebuilding = true;
          broadcast({ type: "rebuilding" });
          builder.handleChange("hyperbook.json", "change")
            .then(() => {
              broadcast({ type: "rebuild-complete" });
            })
            .catch((e) => {
              console.error(`${chalk.red("[Error]")}: ${e instanceof Error ? e.message : e}`);
            })
            .finally(() => {
              rebuilding = false;
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
  const handleFileChange = (eventType: "add" | "change" | "unlink") => async (file: string) => {
    if (!rebuilding) {
      console.log(`${chalk.yellow(`[File ${eventType}]`)}: ${file}`);
      rebuilding = true;
      broadcast({ type: "rebuilding" });
      try {
        const result = await builder.handleChange(file, eventType);
        console.log(`${chalk.yellow("[Reloading]")}: Website`);
        sendReload(result.changedPages);
      } catch (e) {
        if (e instanceof Error) {
          console.error(`${chalk.red("[Error]")}: ${e.message}.`);
        } else {
          console.error(`${chalk.red("[Error]")}: ${e}.`);
        }
      }
      rebuilding = false;
    }
  };

  await builder.initialize();

  server.listen(port, () => {
    console.log(
      `${chalk.yellow("[DEV-SERVER]")} is running at http://localhost:${port}`,
    );
  });

  ////////////////////
  // File Watching
  ////////////////////

  chokidar
    .watch(".", {
      ignoreInitial: true,
      cwd: root,
      usePolling: true,
      interval: 600,
      ignored: [outDir, path.join("archives", "*.zip")],
    })
    .on("add", handleFileChange("add"))
    .on("change", handleFileChange("change"))
    .on("unlink", handleFileChange("unlink"));
}
