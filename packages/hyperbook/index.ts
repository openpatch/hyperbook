#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import checkForUpdate from "update-check";
import { runArchive } from "./archive";
import { runBuild } from "./build";
import { runDev } from "./dev";
import { getPkgManager } from "./helpers/get-pkg-manager";
import { runNew } from "./new";
import packageJson from "./package.json";
import { runSetup } from "./setup";

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
  .usage(`${chalk.green("<book-directory>")} [options]`)
  .option(
    "-t, --template [name]|[github-url]",
    `
  A template for your hyperbook. You can use an template name
  from the official hyperbook repo or a GitHub URL. The URL can use
  any branch and/or subdirectory
`
  )
  .action(async (name, options) => {
    const template =
      typeof options.template === "string" && options.template.trim();
    await runNew({
      programName: program.name(),
      bookPath: name,
      template,
    }).catch(() => process.exit(1));
  });

program
  .command("dev")
  .description("start the development server for a hyperbook")
  .action(async () => {
    await runDev().catch(() => process.exit(1));
  });

program
  .command("setup")
  .description("downloads the latest version of the template of a hyperbook")
  .action(async () => {
    await runSetup().catch(() => process.exit(1));
  });

program
  .command("build")
  .description("build a hyperbook")
  .action(async () => {
    await runArchive().catch(() => process.exit(1));
    await runBuild().catch(() => process.exit(1));
  });

program
  .command("archive")
  .description("create archives from archives folder")
  .action(async () => {
    await runArchive().catch(() => process.exit(1));
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
