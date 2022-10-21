#!/usr/bin/env node

import { Link } from "@hyperbook/types";
import chalk from "chalk";
import { Command } from "commander";
import checkForUpdate from "update-check";
import { runArchive } from "./archive";
import { runBuildProject } from "./build";
import { runDev } from "./dev";
import { getPkgManager } from "./helpers/get-pkg-manager";
import { collect } from "./helpers/project";
import { runNew } from "./new";
import packageJson from "./package.json";
import { runSetupProject } from "./setup";

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
  .action(async (name) => {
    await runNew({
      programName: program.name(),
      bookPath: name,
    }).catch(() => process.exit(1));
  });

program
  .command("dev")
  .description("start the development server for a hyperbook")
  .action(async () => {
    await runDev();
  });

program
  .command("setup")
  .description("downloads the latest version of the template of a hyperbook")
  .action(async () => {
    const rootProject = await collect(process.cwd()).catch(() => {
      process.exit(1);
    });

    await runSetupProject(rootProject).catch(() => {
      process.exit(1);
    });
  });

program
  .command("build")
  .description("build a hyperbook")
  .action(async () => {
    const rootProject = await collect(process.cwd()).catch(() => {
      process.exit(1);
    });
    await runBuildProject(rootProject, rootProject).catch(() => {
      process.exit(1);
    });
  });

program
  .command("archive")
  .description("create archives from archives folder")
  .action(async () => {
    await runArchive(process.cwd()).catch(() => process.exit(1));
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
        chalk.yellow.bold("A new version of `hyperbook` is available!")
      );
      console.log(
        "You can update by running: " +
          chalk.cyan(
            pkgManager === "yarn"
              ? "yarn global add hyperbook"
              : `${pkgManager} install --global hyperbook`
          )
      );
      console.log();
    }
    process.exit();
  } catch {
    // ignore error
  }
}
