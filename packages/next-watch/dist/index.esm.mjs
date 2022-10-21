#!/usr/bin/env node
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/project.ts
import fs from "fs/promises";
import chalk from "chalk";
import path from "path";
function collect(root, basePath, label, icon) {
  return __async(this, null, function* () {
    var _a;
    const hyperbookJson = yield fs.readFile(path.join(root, "hyperbook.json")).then((data) => JSON.parse(data.toString())).catch((e) => {
      if (e instanceof SyntaxError) {
        console.error(e);
      }
      return null;
    });
    if (hyperbookJson) {
      let href = (_a = basePath != null ? basePath : hyperbookJson.basePath) != null ? _a : "/";
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
        basePath: basePath != null ? basePath : hyperbookJson.basePath,
        template: hyperbookJson.template,
        name: label != null ? label : hyperbookJson.name,
        icon
      };
    }
    const hyperlibraryJson = yield fs.readFile(path.join(root, "hyperlibrary.json")).then((data) => JSON.parse(data.toString())).catch((e) => {
      if (e instanceof SyntaxError) {
        console.error(e);
      }
      return null;
    });
    if (hyperlibraryJson) {
      const projects = yield Promise.all(
        hyperlibraryJson.library.map(
          (_0) => __async(this, [_0], function* ({ src, basePath: localBasePath, name, icon: icon2 }) {
            var _a2;
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
                (_a2 = basePath != null ? basePath : hyperlibraryJson.basePath) != null ? _a2 : "",
                localBasePath
              ),
              name,
              icon2
            );
          })
        )
      );
      return {
        type: "library",
        name: label != null ? label : hyperlibraryJson.name,
        basePath: basePath != null ? basePath : hyperlibraryJson.basePath,
        src: root,
        icon,
        projects
      };
    }
    console.log(
      `${chalk.red("Error")} - Missing book or library for path ${root}.`
    );
    throw Error(`Missing book or library for path ${root}`);
  });
}
var init_project = __esm({
  "src/project.ts"() {
    "use strict";
  }
});

// src/index.ts
import chokidar from "chokidar";
import chalk2 from "chalk";
import express from "express";
import next from "next";
import path2 from "path";
import { parse } from "url";
var require_src = __commonJS({
  "src/index.ts"(exports) {
    init_project();
    var createNextApp = (root, basePath) => __async(exports, null, function* () {
      const app = next({
        dev: true,
        dir: root,
        conf: {
          basePath,
          env: {
            root
          }
        }
      });
      return app.prepare().then(() => {
        chokidar.watch(["./book", "./glossary", "./hyperbook.json", "./public"], {
          usePolling: false,
          cwd: root
        }).on("change", (filePath) => __async(exports, null, function* () {
          app.server.hotReloader.send("building");
          const global = filePath.startsWith("hyperbook.json") || filePath.startsWith("public");
          const pages = [];
          if (filePath.startsWith("book") || global) {
            pages.push("/[[...page]]");
          } else if (filePath.startsWith("glossary") || global) {
            pages.push("/glossary/[...term]", "/glossary");
          }
          app.server.hotReloader.send({
            event: "serverOnlyChanges",
            pages
          });
        }));
        return app;
      });
    });
    var handleProject = (server) => (project) => __async(exports, null, function* () {
      if (project.type === "book") {
        const root = path2.join(project.src, ".hyperbook");
        let basePath = project.basePath;
        if (basePath && !basePath.startsWith("/")) {
          basePath = "/" + basePath;
        }
        if (basePath && basePath.endsWith("/")) {
          basePath = basePath.slice(0, -1);
        }
        const app = yield createNextApp(root, basePath);
        const handle = app.getRequestHandler();
        const paths = [project.href, path2.join(project.href, "*")];
        server.all(paths, (req, res) => {
          handle(req, res, parse(req.url, true));
        });
      } else if (project.type === "library") {
        yield Promise.all(project.projects.map(handleProject(server)));
      }
    });
    function run() {
      return __async(this, null, function* () {
        const root = path2.join(process.cwd(), "..");
        const project = yield collect(root);
        if (project.type === "library") {
          console.log(
            chalk2.red(
              `\`hyperbook dev\` is currently not supported for libraries. You have to run \`hyperbook dev\` in a folder containing a book.`
            )
          );
          return;
        }
        const server = express();
        yield handleProject(server)(project);
        process.chdir(root);
        const port = process.env.PORT || 3e3;
        server.listen(port, () => {
          console.log(`> Ready on http://localhost:${port}`);
        });
      });
    }
    run();
  }
});
export default require_src();
//# sourceMappingURL=index.esm.mjs.map
