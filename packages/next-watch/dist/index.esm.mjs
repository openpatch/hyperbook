#!/usr/bin/env node

// src/index.ts
import chokidar from "chokidar";
import express from "express";
import next from "next";
import path2 from "path";
import { parse } from "url";

// src/project.ts
import fs from "fs/promises";
import chalk from "chalk";
import path from "path";
async function collect(root, basePath, label, icon) {
  const hyperbookJson = await fs.readFile(path.join(root, "hyperbook.json")).then((data) => JSON.parse(data.toString())).catch((e) => {
    if (e instanceof SyntaxError) {
      console.error(e);
    }
    return null;
  });
  if (hyperbookJson) {
    let href = basePath ?? hyperbookJson.basePath ?? "/";
    if (!href.startsWith("/")) {
      href = "/" + href;
    }
    if (href.length > 1 && href.endsWith("/")) {
      href = href.slice(0, -1);
    }
    return {
      type: "book",
      src: root,
      href,
      basePath: basePath ?? hyperbookJson.basePath,
      template: hyperbookJson.template,
      name: label ?? hyperbookJson.name,
      icon
    };
  }
  const hyperlibraryJson = await fs.readFile(path.join(root, "hyperlibrary.json")).then((data) => JSON.parse(data.toString())).catch((e) => {
    if (e instanceof SyntaxError) {
      console.error(e);
    }
    return null;
  });
  if (hyperlibraryJson) {
    const projects = await Promise.all(
      hyperlibraryJson.library.map(
        async ({ src, basePath: localBasePath, name, icon: icon2 }) => {
          if (!localBasePath) {
            console.log(
              chalk.red(
                `Missing basePath for book ${name} in library ${path.join(
                  root,
                  "hyperlibrary.json"
                )}`
              )
            );
          }
          return collect(
            path.join(root, src),
            path.join(
              basePath ?? hyperlibraryJson.basePath ?? "",
              localBasePath
            ),
            name,
            icon2
          );
        }
      )
    );
    return {
      type: "library",
      name: label ?? hyperlibraryJson.name,
      basePath: basePath ?? hyperlibraryJson.basePath,
      src: root,
      icon,
      projects
    };
  }
  console.log(
    `${chalk.red("Error")} - Missing book or library for path ${root}.`
  );
  throw Error(`Missing book or library for path ${root}`);
}

// src/index.ts
var createNextApp = async (root, basePath) => {
  const app = next({
    dev: true,
    dir: root,
    hostname: "localhost",
    port: Number(process.env.PORT) || 3e3,
    conf: {
      basePath,
      env: {
        root
      }
    }
  });
  return app.prepare().then(async () => {
    const appServer = app.server || await app.getServer();
    chokidar.watch(["./book", "./glossary", "./hyperbook.json", "./public"], {
      usePolling: false,
      cwd: root
    }).on("add", async (filePath) => {
      appServer.hotReloader.send("building");
      const global = filePath.startsWith("hyperbook.json") || filePath.startsWith("public");
      const pages = [];
      if (filePath.startsWith("book") || global) {
        pages.push("/[[...page]]");
      } else if (filePath.startsWith("glossary") || global) {
        pages.push("/glossary/[...term]", "/glossary");
      }
      appServer.hotReloader.send({
        event: "serverOnlyChanges",
        pages
      });
    }).on("unlink", async (filePath) => {
      appServer.hotReloader.send("building");
      const global = filePath.startsWith("hyperbook.json") || filePath.startsWith("public");
      const pages = [];
      if (filePath.startsWith("book") || global) {
        pages.push("/[[...page]]");
      } else if (filePath.startsWith("glossary") || global) {
        pages.push("/glossary/[...term]", "/glossary");
      }
      appServer.hotReloader.send({
        event: "serverOnlyChanges",
        pages
      });
    }).on("change", async (filePath) => {
      appServer.hotReloader.send("building");
      const global = filePath.startsWith("hyperbook.json") || filePath.startsWith("public");
      const pages = [];
      if (filePath.startsWith("book") || global) {
        pages.push("/[[...page]]");
      } else if (filePath.startsWith("glossary") || global) {
        pages.push("/glossary/[...term]", "/glossary");
      }
      appServer.hotReloader.send({
        event: "serverOnlyChanges",
        pages
      });
    });
    return app;
  });
};
var handleProject = (server) => async (project) => {
  if (project.type === "book") {
    const root = path2.join(project.src, ".hyperbook");
    let basePath = project.basePath;
    if (basePath && !basePath.startsWith("/")) {
      basePath = "/" + basePath;
    }
    if (basePath && basePath.endsWith("/")) {
      basePath = basePath.slice(0, -1);
    }
    const app = await createNextApp(root, basePath);
    const handle = app.getRequestHandler();
    const paths = [
      project.href,
      project.href.endsWith("/") ? project.href + "*" : project.href + "/*"
    ];
    server.all(paths, (req, res) => {
      handle(req, res, parse(req.url, true));
    });
  } else if (project.type === "library") {
    await Promise.all(project.projects.map(handleProject(server)));
  }
};
async function run() {
  console.log(`> Starting dev server ...`);
  const root = path2.join(process.cwd(), "..");
  const project = await collect(root);
  const server = express();
  await handleProject(server)(project);
  process.chdir(root);
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}
run();
//# sourceMappingURL=index.esm.mjs.map
