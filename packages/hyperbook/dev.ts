import chokidar from "chokidar";
import { hyperproject } from "@hyperbook/fs";
import { runBuildProject } from "./build";
import path from "path";
import http from "http";
import fs from "fs";
import mime from "mime";
import { WebSocketServer } from "ws";
import { OutgoingHttpHeaders } from "http2";
import chalk from "chalk";

export async function runDev({ port = 8080 }: { port: number }): Promise<void> {
  const root = process.cwd();
  const rootProject = await hyperproject.get(root);
  const outDir = path.join(rootProject.src, ".hyperbook", "out");

  const server = http.createServer(async (request, response) => {
    // Special Case: Reject non-GET methods.
    if (request.method !== "GET") {
      const responseBody = `Forbidden Method: ${request.method}`;

      response.writeHead(403, {
        "Content-Type": "plain/text",
        "Content-Length": Buffer.byteLength(responseBody),
      });

      return response.end(responseBody);
    }

    // Special Case: GET '/client.js'
    if (request.url === "/__hyperbook_dev.js") {
      const responseBody = `
const socket = new WebSocket("ws://localhost:${port}");
socket.addEventListener("message", (event) => {
  if (event.data === "RELOAD") {
    const main = document.querySelector("main");
    if (main) {
      localStorage.setItem("__hyperbook_dev_scroll", main.scrollTop);
    }
    window.location.reload();
  }
});
window.onload = () => {
  const main = document.querySelector("main");
  const scrollTop = localStorage.getItem("__hyperbook_dev_scroll");
  if (main && scrollTop !== null) {
    main.scrollTop = parseInt(scrollTop, 10);
    localStorage.removeItem("__hyperbook_dev_scroll");
  }
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
        "Content-Type": "plain/text",
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

  reloadServer.on("reload", () => {
    reloadServer.clients.forEach((client) => {
      client.send("RELOAD");
    });
  });

  let rebuilding = false;
  const rebuild = (status: string) => async (file: string) => {
    if (!rebuilding) {
      console.log(`${chalk.yellow(`[Rebuilding ${status}]`)}: ${file}.`);
      rebuilding = true;
      try {
        const rootProject = await hyperproject.get(process.cwd());
        await runBuildProject(rootProject, rootProject);
        console.log(`${chalk.yellow(`[Reloading]`)}: Website`);
        reloadServer.emit("reload");
      } catch (e) {
        if (e instanceof Error) {
          console.error(`${chalk.red(`[Error]`)}: ${e.message}.`);
        } else {
          console.error(`${chalk.red(`[Error]`)}: ${e}.`);
        }
      }
      rebuilding = false;
    }
  };
  await rebuild("(Initialize)")("");

  server.listen(port, () => {
    console.log(
      `${chalk.yellow(`[DEV-SERVER]`)} is running at http://localhost:${port}`,
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
    .on("add", rebuild("(Added)"))
    .on("change", rebuild("(Changed)"))
    .on("unlink", rebuild("(Deleted)"));
}
