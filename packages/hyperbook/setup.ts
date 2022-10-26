import rimraf from "rimraf";
import chalk from "chalk";
import cpy from "cpy";
import fs from "fs/promises";
import { install } from "./helpers/install";
import { getOnline } from "./helpers/is-online";
import { makeDir } from "./helpers/make-dir";
import path from "path";
import { makeSymlink } from "./helpers/make-symlink";
import { getProjectName, Project } from "./helpers/project";

export async function runSetupProject(project: Project, rootProject?: Project) {
  const name = getProjectName(project);
  console.log(`${chalk.blue(`[${name}]`)} Setup Project.`);
  const projectRoot = path.join(project.src, ".hyperbook");
  const root = path.join(rootProject?.src || "", ".hyperbook");

  rimraf.sync(projectRoot);

  const filesPath = path.join(__dirname, "templates");
  await makeDir(projectRoot);
  await cpy("default/.hyperbook/**", projectRoot, {
    cwd: filesPath,
    followSymbolicLinks: false,
  });

  if (process.env.HYPERBOOK_LOCAL_DEV) {
    const packageJson = await fs
      .readFile(
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "platforms",
          "web",
          "package.json"
        )
      )
      .then((f) => JSON.parse(f.toString()));

    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify(
        {
          ...packageJson,
          name: `@docs/` + name.toLowerCase().replace(" ", "-"),
          scripts: {
            "next:dev": "next-hyperbook-watch",
            "next:build": "next build && next export",
          },
        },
        null,
        2
      )
    );
  } else {
    if (!rootProject) {
      const isOnline = await getOnline();
      await install(root, null, { packageManager: "npm", isOnline });
    } else {
      await makeSymlink(
        path.join(root, "node_modules"),
        path.join(projectRoot, "node_modules")
      );
    }
  }

  if (project.type === "library") {
    await makeSymlink(
      path.join(project.src, "hyperlibrary.json"),
      path.join(projectRoot, "hyperlibrary.json")
    );

    for (const p of project.projects) {
      await runSetupProject(p, rootProject);
    }

    return;
  }

  await makeSymlink(
    path.join(project.src, "archives"),
    path.join(projectRoot, "archives")
  );
  await makeSymlink(
    path.join(project.src, "book"),
    path.join(projectRoot, "book")
  );
  await makeSymlink(
    path.join(project.src, "glossary"),
    path.join(projectRoot, "glossary")
  );
  await makeSymlink(
    path.join(project.src, "public"),
    path.join(projectRoot, "public")
  );
  await makeSymlink(
    path.join(project.src, "hyperbook.json"),
    path.join(projectRoot, "hyperbook.json")
  );
}
