#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import checkForUpdate from "update-check";
import { runBuildProject } from "./build";
import { runDev } from "./dev";
import { getPkgManager } from "./helpers/get-pkg-manager";
import { hyperproject } from "@hyperbook/fs";
import { runNew } from "./new";
import packageJson from "./package.json";

const program = new Command();

program
  .name(packageJson.name)
  .version(packageJson.version)
  .hook("preAction", async () => {
    await notifyUpdate();
  });

program
  .command("new")
  .description("create a new hyperbook")
  .arguments("<book-directory>")
  .usage(`${chalk.green("<book-directory>")}`)
  .action(async (name: string) => {
    await runNew({
      programName: program.name(),
      bookPath: name,
    }).catch(() => process.exit(1));
  });

program
  .command("dev")
  .description("start the development server for a hyperbook")
  .option("-p --port <number>", "set a specific port")
  .action(async (name, options) => {
    await runDev({
      port: options.port,
    });
  });

program
  .command("build")
  .description("build a hyperbook")
  .action(async () => {
    const rootProject = await hyperproject.get(process.cwd()).catch((e) => {
      console.error(e);
      process.exit(1);
    });
    let name = hyperproject.getName(rootProject);
    console.log(
      `${chalk.blue(`[${name}]`)} Building Project: ${rootProject.src}.`,
    );
    await runBuildProject(rootProject, rootProject).catch((e) => {
      console.error(e);
      process.exit(1);
    });
  });

program.parseAsync(process.argv);

const update = checkForUpdate(packageJson).catch(() => null);

async function notifyUpdate(): Promise<void> {
  try {
    const res = await update;
    if (res?.latest) {
      const pkgManager = getPkgManager();

      console.log();
      console.log(
        chalk.yellow.bold("A new version of `hyperbook` is available!"),
      );
      console.log(
        "You can update by running: " +
          chalk.cyan(
            pkgManager === "yarn"
              ? "yarn global add hyperbook"
              : `${pkgManager} install --global hyperbook`,
          ),
      );
      console.log();
    }
    process.exit();
  } catch {
    // ignore error
  }
}
