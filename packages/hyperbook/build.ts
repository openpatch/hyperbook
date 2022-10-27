import spawn from "cross-spawn";
import path from "path";
import fs from "fs";
import readline from "readline";
import chalk from "chalk";
import { isSetup } from "./helpers/is-setup";
import { readHyperbook } from "./helpers/read-hyperbook";
import { getProjectName, makeLinkForHyperproject } from "@hyperbook/fs";
import { runArchive } from "./archive";
import { makeDir } from "./helpers/make-dir";
import rimraf from "rimraf";
import { Link, Hyperproject } from "@hyperbook/types";
import { makeEnv } from "./helpers/make-env";

export async function runBuildProject(
  project: Hyperproject,
  rootProject: Hyperproject,
  out?: string
): Promise<void> {
  const name = getProjectName(project);
  if (project.type === "book") {
    console.log(`${chalk.blue(`[${name}]`)} Building Book.`);
    await runBuild(project.src, rootProject, project.basePath, name, out);
  } else {
    if (!out) {
      out = project.src;
      rimraf.sync(path.join(out, ".hyperbook", "out"));
    }
    console.log(`${chalk.blue(`[${name}]`)} Building Library.`);
    for (const p of project.projects) {
      await runBuildProject(p, rootProject, out);
    }
  }
}

async function runBuild(
  root: string,
  rootProject: Hyperproject,
  basePath?: string,
  prefix?: string,
  out?: string
): Promise<void> {
  const setup = isSetup(root);
  if (!setup) {
    throw new Error("no setup");
  }

  await runArchive(root, prefix);

  const hyperbook = await readHyperbook(root);

  if (!basePath && hyperbook?.basePath) {
    basePath = hyperbook.basePath;
  }

  if (basePath && !basePath.startsWith("/")) {
    basePath = "/" + basePath;
  }

  if (basePath && basePath.endsWith("/")) {
    basePath = basePath.slice(0, -1);
  }

  fs.writeFileSync(
    path.join(root, ".hyperbook", "next.config.js"),
    `
module.exports = {
    ${basePath ? `basePath: '${basePath}',` : ""}
    typescript: {
      ignoreBuildErrors: true,
    }
}
      `
  );

  const hyperbookJson = await readHyperbook(root);
  let link: Link | undefined = undefined;
  if (rootProject.type === "library") {
    link = await makeLinkForHyperproject(rootProject, hyperbookJson.language);
  }
  if (link) {
    if (!hyperbookJson.links) {
      hyperbookJson.links = [link];
    } else {
      hyperbookJson.links.push(link);
    }
  }

  hyperbookJson.basePath = basePath;

  fs.cpSync(
    path.join(root, "hyperbook.json"),
    path.join(root, ".hyperbook", "hyperbook.json"),
    {
      force: true,
    }
  );

  fs.writeFileSync(
    path.join(root, ".hyperbook", "hyperbook.json"),
    JSON.stringify(hyperbookJson, null, 2)
  );

  return new Promise((resolve, reject) => {
    const command = "npm";
    const args = ["run", "next:build"];
    const env = makeEnv();
    const child = spawn(command, args, {
      stdio: "pipe",
      cwd: path.join(root, ".hyperbook"),
      env: {
        ...process.env,
        ...env,
        ADBLOCK: "1",
        DISABLE_OPENCOLLECTIVE: "1",
      },
    });

    const exportingText = `${chalk.blue(`[${prefix}]`)} Exporting HTML files`;

    let i = 0;
    const loader = setInterval(() => {
      if (!process.env.CI) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(exportingText + ".".repeat(i));
        i = (i + 1) % 5;
      }
    }, 500);

    if (process.env.CI) {
      process.stdout.write(exportingText + ".\n");
    }

    child.stderr?.on("data", (chunk) => {
      if (!String(chunk).startsWith("warn")) {
        console.log(`${chalk.red(`[${prefix}]`)} ` + chunk);
      }
    });
    child.on("close", (code) => {
      clearInterval(loader);
      if (code !== 0) {
        process.stdout.write("\n");
        reject({ command: `${command} ${args.join(" ")}` });
        return;
      } else {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        const normalOut = path.join(root, ".hyperbook", "out");
        if (!out) {
          process.stdout.write(
            `${chalk.green(
              `[${prefix}]`
            )} Export successful. Files written to ${normalOut}.\n`
          );
          resolve();
        } else {
          const newOut = path.join(out, ".hyperbook", "out", basePath || "");
          makeDir(newOut)
            .then(() => {
              fs.cpSync(normalOut, newOut, { recursive: true, force: true });
              process.stdout.write(
                `${chalk.green(
                  `[${prefix}]`
                )} Export successful. Files written to ${newOut}.\n`
              );
              resolve();
            })
            .catch((e) => {
              process.stdout.write("\n");
              console.error(e);
              reject();
            });
        }
      }
    });
  });
}
