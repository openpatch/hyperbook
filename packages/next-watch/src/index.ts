#!/usr/bin/env node
import chokidar from "chokidar";
import chalk from "chalk";
import express from "express";
import * as core from "express-serve-static-core";
import next from "next";
import path from "path";
import { parse } from "url";
import { collect, Project } from "./project";

const createNextApp = async (root: string, basePath?: string) => {
  const app = next({
    dev: true,
    dir: root,
    hostname: "localhost",
    port: Number(process.env.PORT) || 3000,
    conf: {
      basePath,
      env: {
        root,
      },
    },
  });

  return app.prepare().then(async () => {
    // if directories are provided, watch them for changes and trigger reload
    const appServer: any =
      (app as any).server || (await (app as any).getServer());
    chokidar
      .watch(["./book", "./glossary", "./hyperbook.json", "./public"], {
        usePolling: false,
        cwd: root,
      })
      .on("add", async (filePath) => {
        appServer.hotReloader.send("building");

        const global =
          filePath.startsWith("hyperbook.json") ||
          filePath.startsWith("public");

        const pages = [];
        if (filePath.startsWith("book") || global) {
          pages.push("/[[...page]]");
        } else if (filePath.startsWith("glossary") || global) {
          pages.push("/glossary/[...term]", "/glossary");
        }

        // @ts-ignore
        // https://github.com/hashicorp/next-remote-watch/issues/42
        appServer.hotReloader.send({
          event: "serverOnlyChanges",
          pages,
        });
      })
      .on("unlink", async (filePath) => {
        appServer.hotReloader.send("building");

        const global =
          filePath.startsWith("hyperbook.json") ||
          filePath.startsWith("public");

        const pages = [];
        if (filePath.startsWith("book") || global) {
          pages.push("/[[...page]]");
        } else if (filePath.startsWith("glossary") || global) {
          pages.push("/glossary/[...term]", "/glossary");
        }

        // @ts-ignore
        // https://github.com/hashicorp/next-remote-watch/issues/42
        appServer.hotReloader.send({
          event: "serverOnlyChanges",
          pages,
        });
      })
      .on("change", async (filePath) => {
        appServer.hotReloader.send("building");

        const global =
          filePath.startsWith("hyperbook.json") ||
          filePath.startsWith("public");

        const pages = [];
        if (filePath.startsWith("book") || global) {
          pages.push("/[[...page]]");
        } else if (filePath.startsWith("glossary") || global) {
          pages.push("/glossary/[...term]", "/glossary");
        }

        // @ts-ignore
        // https://github.com/hashicorp/next-remote-watch/issues/42
        appServer.hotReloader.send({
          event: "serverOnlyChanges",
          pages,
        });
      });
    return app;
  });
};

const handleProject = (server: core.Express) => async (project: Project) => {
  if (project.type === "book") {
    const root = path.join(project.src, ".hyperbook");
    let basePath = project.basePath;

    if (basePath && !basePath.startsWith("/")) {
      basePath = "/" + basePath;
    }

    if (basePath && basePath.endsWith("/")) {
      basePath = basePath.slice(0, -1);
    }

    const app = await createNextApp(root, basePath);
    const handle = app.getRequestHandler();
    // handle all other routes with next.js
    const paths = [
      project.href,
      project.href.endsWith("/") ? project.href + "*" : project.href + "/*",
    ];
    server.all(paths, (req, res) => {
      handle(req as any, res, parse(req.url, true));
    });
  } else if (project.type === "library") {
    await Promise.all(project.projects.map(handleProject(server)));
  }
};

async function run() {
  console.log(`> Starting dev server ...`);
  const root = path.join(process.cwd(), "..");
  const project = await collect(root);
  //if (project.type !== "library") {
  //  console.log(
  //    chalk.red(
  //      `\`hyperbook dev\` is currently not supported for libraries. You have to run \`hyperbook dev\` in a folder containing a book.`
  //    )
  //  );
  //  return;
  //}
  // create an express server
  const server = express();
  await handleProject(server)(project);

  process.chdir(root);

  // fire it up
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

run();
